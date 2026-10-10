
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createWorker } from "tesseract.js";
import { supabase } from "@/lib/supabase";

const categories = [
  "Movies",
  "Events",
  "Gift Cards",
  "Trains",
  "Buses",
] as const;

type CheckStatus = "matched" | "review" | "mismatch" | "unreadable";

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fieldMatchesTicket(value: string, ticketText: string) {
  const input = normalizeText(value);
  const extracted = normalizeText(ticketText);

  if (!input || !extracted) return false;
  if (extracted.includes(input)) return true;

  const words = input.split(" ").filter((word) => word.length > 2);
  if (!words.length) return false;

  const matches = words.filter((word) => extracted.includes(word));
  return matches.length / words.length >= 0.5;
}

export default function SellPage() {
  const router = useRouter();
  const [category, setCategory] = useState("Movies");
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [checkStatus, setCheckStatus] = useState<CheckStatus | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function resetCheck() {
    setExtractedText("");
    setCheckStatus(null);
  }

  async function analyzeTicket() {
    if (!ticketFile) {
      setMessage("Please select a ticket image first.");
      return;
    }

    setMessage("");
    resetCheck();
    setIsAnalyzing(true);

    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

    try {
      worker = await createWorker("eng");
      const result = await worker.recognize(ticketFile);
      const text = result.data.text.trim();

      setExtractedText(text);

      if (text.length < 5) {
        setCheckStatus("unreadable");
        return;
      }

      const fields = [
        { value: title, required: true },
        { value: venue, required: false },
        { value: location, required: false },
      ].filter((field) => field.value.trim());

      if (!fields.length) {
        setCheckStatus("review");
        return;
      }

      const matches = fields.filter((field) =>
        fieldMatchesTicket(field.value, text)
      );

      const titleMatches = fieldMatchesTicket(title, text);
      const venueMatches =
        !venue.trim() || fieldMatchesTicket(venue, text);

      if (
        titleMatches &&
        venueMatches &&
        matches.length === fields.length
      ) {
        setCheckStatus("matched");
      } else if (matches.length > 0) {
        setCheckStatus("review");
      } else {
        setCheckStatus("mismatch");
      }
    } catch (error) {
      console.error("OCR error:", error);
      setMessage(
        "Could not read the image. Try a clearer JPG, PNG, or WebP."
      );
    } finally {
      if (worker) {
        await worker.terminate();
      }
      setIsAnalyzing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (!ticketFile) {
      setMessage("Please upload a ticket image.");
      return;
    }

    if (!extractedText || !checkStatus) {
      setMessage("Analyze the ticket image before submitting.");
      return;
    }

    if (checkStatus === "unreadable") {
      setMessage("Upload a clearer image before submitting.");
      return;
    }

    if (!title.trim() || !description.trim()) {
      setMessage("Enter the required listing details.");
      return;
    }

    const amount = Number(price);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Enter a valid selling price greater than zero.");
      return;
    }

    setLoading(true);

    let uploadedPath: string | null = null;

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/auth?mode=login");
        return;
      }

      const allowedTypes: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };

      const extension = allowedTypes[ticketFile.type];

      if (!extension) {
        throw new Error("Only JPG, PNG, and WebP images are allowed.");
      }

      if (ticketFile.size > 8 * 1024 * 1024) {
        throw new Error("The image must be smaller than 8 MB.");
      }

      // Each upload uses a unique name inside the seller's own folder.
      const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("ticket-evidence")
        .upload(filePath, ticketFile, {
          contentType: ticketFile.type,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(
          `Ticket image upload failed: ${uploadError.message}`
        );
      }

      uploadedPath = filePath;

      // Save only the private storage path, never a public image URL.
      const { error: insertError } = await supabase
        .from("listings")
        .insert({
          seller_id: user.id,
          category,
          title: title.trim(),
          venue: venue.trim() || null,
          location: location.trim() || null,
          price: amount,
          description: description.trim(),
          evidence_path: uploadedPath,
          status: "pending",
        });

      if (insertError) {
        throw new Error(
          `Image uploaded privately, but listing creation failed: ${insertError.message}. The unused private image may need cleanup.`
        );
      }

      setMessage(
        "Listing and private ticket image saved successfully. Your listing is pending review."
      );

      setCategory("Movies");
      setTitle("");
      setVenue("");
      setLocation("");
      setPrice("");
      setDescription("");
      setTicketFile(null);
      setExtractedText("");
      setCheckStatus(null);

      const input = document.getElementById(
        "ticket-image"
      ) as HTMLInputElement | null;

      if (input) input.value = "";
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to submit the listing. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const statusDetails: Record<
    CheckStatus,
    { title: string; description: string; style: string }
  > = {
    matched: {
      title: "Details Matched",
      description:
        "The entered details appear in the extracted text. This does not prove ticket authenticity.",
      style: "border-green-500/30 bg-green-500/10 text-green-300",
    },
    review: {
      title: "Needs Review",
      description:
        "Some details matched, or the comparison was inconclusive.",
      style: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    },
    mismatch: {
      title: "Mismatch Detected",
      description:
        "The entered details were not found in the extracted text. Check the information and image.",
      style: "border-red-500/30 bg-red-500/10 text-red-300",
    },
    unreadable: {
      title: "Image Unreadable",
      description:
        "Very little text was detected. Please upload a clearer image.",
      style: "border-red-500/30 bg-red-500/10 text-red-300",
    },
  };

  return (
    <main className="min-h-screen bg-[#080b12] px-5 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="font-bold text-amber-400">
          ◈ CineRelay
        </Link>

        <h1 className="mt-8 text-3xl font-black sm:text-4xl">
          Sell your ticket
        </h1>

        <p className="mt-3 text-gray-400">
          Upload your ticket image, check its visible text, and submit your listing.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8"
        >
          <div>
            <label className="mb-2 block text-sm font-medium">
              Category
            </label>
            <select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#111722] p-3 text-white"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Ticket or voucher title
            </label>
            <input
              required
              maxLength={150}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                resetCheck();
              }}
              placeholder="e.g. Movie ticket - evening show"
              className="w-full rounded-xl border border-white/10 bg-[#111722] p-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Venue or operator
            </label>
            <input
              value={venue}
              onChange={(e) => {
                setVenue(e.target.value);
                resetCheck();
              }}
              placeholder="e.g. Cinema or bus operator"
              className="w-full rounded-xl border border-white/10 bg-[#111722] p-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              City or location
            </label>
            <input
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                resetCheck();
              }}
              placeholder="e.g. Guntur"
              className="w-full rounded-xl border border-white/10 bg-[#111722] p-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Selling price (₹)
            </label>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Enter your price"
              className="w-full rounded-xl border border-white/10 bg-[#111722] p-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Description
            </label>
            <textarea
              required
              minLength={5}
              maxLength={3000}
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Include the date, seat details, expiry, and transfer conditions."
              className="w-full rounded-xl border border-white/10 bg-[#111722] p-3"
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#111722] p-4">
            <label
              htmlFor="ticket-image"
              className="mb-2 block text-sm font-semibold"
            >
              Upload ticket image *
            </label>

            <p className="mb-3 text-xs leading-5 text-gray-400">
              JPG, PNG, or WebP. Maximum 8 MB. Your image is uploaded to private storage, not a public listing URL.
            </p>

            <input
              id="ticket-image"
              required
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setTicketFile(null);
                resetCheck();
                setMessage("");

                if (!file) return;

                if (
                  !["image/jpeg", "image/png", "image/webp"].includes(file.type)
                ) {
                  setMessage("Choose a JPG, PNG, or WebP image.");
                  e.target.value = "";
                  return;
                }

                if (file.size > 8 * 1024 * 1024) {
                  setMessage("The image must be smaller than 8 MB.");
                  e.target.value = "";
                  return;
                }

                setTicketFile(file);
              }}
              className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-400 file:px-4 file:py-2 file:font-bold file:text-black"
            />

            <button
              type="button"
              onClick={analyzeTicket}
              disabled={!ticketFile || isAnalyzing || loading}
              className="mt-4 w-full rounded-xl border border-amber-400/40 px-4 py-3 font-semibold text-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzing ? "Reading ticket text..." : "Analyze ticket image"}
            </button>

            {checkStatus && (
              <div
                role="status"
                className={`mt-4 rounded-xl border p-4 ${statusDetails[checkStatus].style}`}
              >
                <p className="font-bold">{statusDetails[checkStatus].title}</p>
                <p className="mt-2 text-sm leading-6">
                  {statusDetails[checkStatus].description}
                </p>
              </div>
            )}

            {extractedText && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-300">
                  View extracted text
                </summary>
                <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 text-xs text-gray-300">
                  {extractedText}
                </pre>
              </details>
            )}
          </div>

          <p className="text-xs leading-5 text-gray-500">
            OCR is a text-consistency check only. It cannot prove a ticket is genuine, unused, or transferable. Listings remain pending until the publication workflow is configured.
          </p>

          <button
            type="submit"
            disabled={
              loading ||
              isAnalyzing ||
              !checkStatus ||
              checkStatus === "unreadable"
            }
            className="w-full rounded-xl bg-amber-400 px-5 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Uploading and saving..." : "Submit for review"}
          </button>

          {message && (
            <p
              role="status"
              className="break-words rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-200"
            >
              {message}
            </p>
          )}
        </form>

        <Link
          href="/"
          className="mt-6 inline-block text-sm text-gray-400 hover:text-amber-400"
        >
          ← Back to homepage
        </Link>
      </div>
    </main>
  );
}
