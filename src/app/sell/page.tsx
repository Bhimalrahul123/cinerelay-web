
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createWorker } from "tesseract.js";
import { supabase } from "@/lib/supabase";

const categories = ["Movies", "Events", "Gift Cards", "Trains", "Buses"] as const;

type CheckStatus = "matched" | "review" | "mismatch" | "unreadable";

type MovieResult = {
  id: number;
  title: string;
  overview: string;
  posterUrl: string | null;
  releaseDate: string;
  rating: number;
};

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

const inputClass =
  "premium-field";

const labelClass =
  "mb-2 block text-sm font-medium text-[#e8e3d8]";

const sectionClass =
  "rounded-2xl border border-white/[0.09] bg-[#101114] p-5 sm:p-8";

export default function SellPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<string>("Movies");
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  const [showDate, setShowDate] = useState("");
  const [showTime, setShowTime] = useState("");
  const [screenNumber, setScreenNumber] = useState("");
  const [seatCategory, setSeatCategory] = useState("");
  const [seatNumbers, setSeatNumbers] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");

  const [movieQuery, setMovieQuery] = useState("");
  const [movieResults, setMovieResults] = useState<MovieResult[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<MovieResult | null>(null);
  const [movieSearchLoading, setMovieSearchLoading] = useState(false);
  const [movieSearchError, setMovieSearchError] = useState("");

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

  function changeCategory(nextCategory: string) {
    setCategory(nextCategory);

    if (nextCategory !== "Movies") {
      setMovieQuery("");
      setMovieResults([]);
      setSelectedMovie(null);
      setMovieSearchError("");
    }

    resetCheck();
    setMessage("");
  }

  async function searchMovies() {
    const query = movieQuery.trim();

    if (query.length < 2) {
      setMovieResults([]);
      setMovieSearchError("Enter at least two characters to search.");
      return;
    }

    setMovieSearchLoading(true);
    setMovieSearchError("");
    setMovieResults([]);

    try {
      const response = await fetch(
        `/api/movies/search?query=${encodeURIComponent(query)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Movie search failed.");
      }

      setMovieResults(data.results ?? []);

      if (!data.results?.length) {
        setMovieSearchError("No movies found. Try another title.");
      }
    } catch (error) {
      setMovieSearchError(
        error instanceof Error
          ? error.message
          : "Unable to search movies right now."
      );
    } finally {
      setMovieSearchLoading(false);
    }
  }

  function chooseMovie(movie: MovieResult) {
    setSelectedMovie(movie);
    setTitle(movie.title);
    setMovieQuery(movie.title);
    setMovieResults([]);
    setMovieSearchError("");
    resetCheck();
    setMessage("");
  }

  async function analyzeTicket() {
    if (!ticketFile) {
      setMessage("Please select a ticket image first.");
      return;
    }

    if (ticketFile.size > 8 * 1024 * 1024) {
      setMessage("The image must be smaller than 8 MB.");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(ticketFile.type)) {
      setMessage("Only JPG, PNG, and WebP images are allowed.");
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

      const fields = [title, venue, location].filter((value) =>
        value.trim()
      );

      if (!fields.length) {
        setCheckStatus("review");
        return;
      }

      const matches = fields.filter((value) =>
        fieldMatchesTicket(value, text)
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

    if (category === "Movies" && !selectedMovie) {
      setMessage(
        "Search for and select the correct movie before submitting."
      );
      return;
    }

    if (!title.trim() || !description.trim()) {
      setMessage("Enter the required listing details.");
      return;
    }

    if (category === "Movies") {
      if (
        !showDate ||
        !showTime ||
        !venue.trim() ||
        !screenNumber.trim() ||
        !seatCategory ||
        !cancellationReason
      ) {
        setMessage(
          "Complete the show date, time, theatre, screen, seat category, and reason for selling."
        );
        return;
      }

      const today = new Date();
      const localToday = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
      ].join("-");

      if (showDate < localToday) {
        setMessage("The show date cannot be in the past.");
        return;
      }
    }

    const amount = Number(price);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Enter a valid selling price greater than zero.");
      return;
    }

    if (ticketFile.size > 8 * 1024 * 1024) {
      setMessage("The image must be smaller than 8 MB.");
      return;
    }

    const allowedTypes: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

    const extension = allowedTypes[ticketFile.type];

    if (!extension) {
      setMessage("Only JPG, PNG, and WebP images are allowed.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/auth?mode=login");
        return;
      }

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

      const { error: insertError } = await supabase
        .from("listings")
        .insert({
          seller_id: user.id,
          category,
          title: title.trim(),
          tmdb_movie_id:
            category === "Movies" ? selectedMovie?.id ?? null : null,
          venue: venue.trim() || null,
          location: location.trim() || null,
          price: amount,
          description: description.trim(),
          evidence_path: filePath,
          status: "pending",
          event_date: category === "Movies" ? showDate : null,
          event_time: category === "Movies" ? showTime : null,
          screen_number:
            category === "Movies" ? screenNumber.trim() : null,
          seat_category:
            category === "Movies" ? seatCategory : null,
          seat_numbers:
            category === "Movies"
              ? seatNumbers.trim() || null
              : null,
          cancellation_reason:
            category === "Movies" ? cancellationReason : null,
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

      setShowDate("");
      setShowTime("");
      setScreenNumber("");
      setSeatCategory("");
      setSeatNumbers("");
      setCancellationReason("");

      setMovieQuery("");
      setMovieResults([]);
      setSelectedMovie(null);
      setMovieSearchError("");

      setTicketFile(null);
      setExtractedText("");
      setCheckStatus(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
    { title: string; description: string }
  > = {
    matched: {
      title: "Details Matched",
      description:
        "The entered details appear in the extracted text. This does not prove ticket authenticity.",
    },
    review: {
      title: "Needs Review",
      description:
        "Some details matched, or the comparison was inconclusive.",
    },
    mismatch: {
      title: "Mismatch Detected",
      description:
        "The entered details were not found in the extracted text. Check the information and image.",
    },
    unreadable: {
      title: "Image Unreadable",
      description:
        "Very little text was detected. Please upload a clearer image.",
    },
  };

  return (
    <main className="min-h-screen bg-[#090a0c] text-[#f5f2eb]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header className="mb-10 flex items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#d6b36a]/25 bg-[#d6b36a]/[0.08] text-2xl text-[#e5ca91]">
              ◈
            </span>
            <span className="text-xl font-semibold tracking-tight">
              Cine<span className="text-[#d6b36a]">Relay</span>
            </span>
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 transition hover:border-[#d6b36a]/40 hover:text-white"
          >
            ← Marketplace
          </Link>
        </header>

        <section className="mb-9">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d6b36a]/25 bg-[#d6b36a]/[0.07] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e5ca91]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d6b36a]" />
            Seller workspace
          </div>

          <h1 className="text-3xl font-semibold tracking-[-0.045em] text-[#fffaf0] sm:text-5xl">
            Turn your plans into
            <span className="block text-[#d6b36a]">
              someone else&apos;s experience.
            </span>
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
            Share your ticket details, check the visible information, and
            submit your listing for review.
          </p>
        </section>

        <div className="mb-8 grid grid-cols-3 gap-3">
          {[
            { number: "01", label: "Ticket details" },
            { number: "02", label: "Image check" },
            { number: "03", label: "Submit for review" },
          ].map((step) => (
            <div
              key={step.number}
              className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 sm:p-4"
            >
              <span className="text-xs font-semibold text-[#d6b36a]">
                {step.number}
              </span>
              <p className="mt-2 text-xs font-medium text-white/75 sm:text-sm">
                {step.label}
              </p>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className={sectionClass}>
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d6b36a]">
                Step 01
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[#fffaf0]">
                What are you selling?
              </h2>
              <p className="mt-2 text-sm text-white/55">
                Choose a category and provide a clear listing title.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {categories.map((item) => {
                const icons: Record<string, string> = {
                  Movies: "▣",
                  Events: "✦",
                  "Gift Cards": "◇",
                  Trains: "↗",
                  Buses: "⇄",
                };

                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={category === item}
                    onClick={() => changeCategory(item)}
                    className={`rounded-xl border p-4 text-left transition ${
                      category === item
                        ? "border-[#d6b36a]/60 bg-[#d6b36a]/[0.09]"
                        : "border-white/[0.09] bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <span className="text-2xl text-[#e5ca91]">
                      {icons[item]}
                    </span>
                    <span className="mt-3 block text-sm font-semibold">
                      {item}
                    </span>
                    <span className="mt-1 block text-xs text-white/45">
                      {category === item ? "Selected" : "Choose category"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6">
              <label className={labelClass}>Listing title *</label>
              <input
                required
                type="text"
                maxLength={150}
                value={title}
                onChange={(e) => {
                  const nextTitle = e.target.value;
                  setTitle(nextTitle);

                  if (selectedMovie && nextTitle !== selectedMovie.title) {
                    setSelectedMovie(null);
                  }

                  resetCheck();
                }}
                placeholder={
                  category === "Movies"
                    ? "Choose a movie below"
                    : "Enter your ticket title"
                }
                className={inputClass}
              />
            </div>
          </section>

          {category === "Movies" && (
            <section className={sectionClass}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d6b36a]">
                Movie database
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[#fffaf0]">
                Find your movie
              </h2>
              <p className="mt-2 text-sm text-white/55">
                Search TMDB and select the correct movie.
              </p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <input
                  type="search"
                  value={movieQuery}
                  onChange={(e) => {
                    setMovieQuery(e.target.value);
                    setMovieSearchError("");

                    if (
                      selectedMovie &&
                      e.target.value !== selectedMovie.title
                    ) {
                      setSelectedMovie(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void searchMovies();
                    }
                  }}
                  placeholder="Search movies, e.g. Interstellar"
                  className={`${inputClass} min-w-0 flex-1`}
                />

                <button
                  type="button"
                  onClick={() => void searchMovies()}
                  disabled={movieSearchLoading}
                  className="premium-button"
                >
                  {movieSearchLoading ? "Searching..." : "Search movies"}
                </button>
              </div>

              {movieSearchError && (
                <p role="status" className="mt-3 text-sm text-amber-200">
                  {movieSearchError}
                </p>
              )}

              {movieResults.length > 0 && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {movieResults.map((movie) => (
                    <button
                      key={movie.id}
                      type="button"
                      onClick={() => chooseMovie(movie)}
                      className="flex min-w-0 items-start gap-4 rounded-xl border border-white/[0.09] bg-white/[0.02] p-3 text-left transition hover:border-[#d6b36a]/40 hover:bg-white/[0.04]"
                    >
                      {movie.posterUrl ? (
                        <img
                          src={movie.posterUrl}
                          alt={`${movie.title} poster`}
                          className="h-28 w-[76px] shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-28 w-[76px] shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-xs text-white/40">
                          No poster
                        </div>
                      )}

                      <span className="min-w-0">
                        <span className="block font-semibold leading-6 text-white">
                          {movie.title}
                        </span>
                        <span className="mt-1 block text-xs text-white/50">
                          {movie.releaseDate || "Release date unavailable"}
                        </span>
                        <span className="mt-2 block text-xs text-[#e5ca91]">
                          Rating: {movie.rating.toFixed(1)}/10
                        </span>
                        <span className="mt-2 block text-xs leading-5 text-white/55">
                          {movie.overview || "No synopsis available."}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {selectedMovie && (
                <div className="mt-5 rounded-xl border border-[#d6b36a]/35 bg-[#d6b36a]/[0.06] p-4">
                  <div className="flex items-start gap-4">
                    {selectedMovie.posterUrl && (
                      <img
                        src={selectedMovie.posterUrl}
                        alt={`${selectedMovie.title} poster`}
                        className="w-16 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d6b36a]">
                        Selected movie
                      </p>
                      <p className="mt-1 font-semibold text-[#fffaf0]">
                        {selectedMovie.title}
                      </p>
                      <p className="mt-1 text-xs text-white/55">
                        {selectedMovie.releaseDate || "Release date unavailable"}
                      </p>
                    </div>
                    <span className="text-xl text-[#d6b36a]">✓</span>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className={sectionClass}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d6b36a]">
              Event information
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#fffaf0]">
              Where and when?
            </h2>

            <div className="mt-6 space-y-5">
              <div>
                <label className={labelClass}>
                  {category === "Movies" ? "Theatre / cinema *" : "Venue / event location"}
                </label>
                <input
                  required={category === "Movies"}
                  type="text"
                  maxLength={150}
                  value={venue}
                  onChange={(e) => {
                    setVenue(e.target.value);
                    resetCheck();
                  }}
                  placeholder={
                    category === "Movies"
                      ? "Enter the theatre name"
                      : "Enter venue, if applicable"
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>City / location</label>
                <input
                  type="text"
                  maxLength={150}
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    resetCheck();
                  }}
                  placeholder="Enter city or area"
                  className={inputClass}
                />
              </div>

              {category === "Movies" && (
                <div className="rounded-xl border border-[#d6b36a]/20 bg-[#d6b36a]/[0.035] p-4 sm:p-5">
                  <h3 className="font-semibold text-[#e5ca91]">
                    Showtime and seat information
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-white/50">
                    Enter the details printed on your ticket.
                  </p>

                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Show date *</label>
                      <input
                        required
                        type="date"
                        value={showDate}
                        min={(() => {
                          const d = new Date();
                          return `${d.getFullYear()}-${String(
                            d.getMonth() + 1
                          ).padStart(2, "0")}-${String(d.getDate()).padStart(
                            2,
                            "0"
                          )}`;
                        })()}
                        onChange={(e) => setShowDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Show time *</label>
                      <input
                        required
                        type="time"
                        value={showTime}
                        onChange={(e) => setShowTime(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Screen number *</label>
                      <input
                        required
                        type="text"
                        maxLength={50}
                        value={screenNumber}
                        onChange={(e) => setScreenNumber(e.target.value)}
                        placeholder="e.g. Screen 3"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Seat category *</label>
                      <select
                        required
                        value={seatCategory}
                        onChange={(e) => setSeatCategory(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select category</option>
                        <option value="Regular">Regular</option>
                        <option value="Silver">Silver</option>
                        <option value="Gold">Gold</option>
                        <option value="Premium">Premium</option>
                        <option value="Recliner">Recliner</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelClass}>
                        Seat numbers (optional)
                      </label>
                      <input
                        type="text"
                        maxLength={150}
                        value={seatNumbers}
                        onChange={(e) => setSeatNumbers(e.target.value)}
                        placeholder="e.g. G12, G13"
                        className={inputClass}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelClass}>Reason for selling *</label>
                      <select
                        required
                        value={cancellationReason}
                        onChange={(e) => setCancellationReason(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select a reason</option>
                        <option value="Personal reasons">Personal reasons</option>
                        <option value="Change of plans">Change of plans</option>
                        <option value="Unable to attend">Unable to attend</option>
                        <option value="Booked by mistake">Booked by mistake</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className={sectionClass}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d6b36a]">
              Pricing
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#fffaf0]">
              Set your asking price
            </h2>

            <div className="mt-6 space-y-5">
              <div>
                <label className={labelClass}>Selling price (₹) *</label>
                <div className="flex items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.025] focus-within:border-[#d6b36a]/60">
                  <span className="px-4 text-lg font-semibold text-[#d6b36a]">
                    ₹
                  </span>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Enter selling price"
                    className="min-w-0 flex-1 border-0 bg-transparent px-2 py-4 text-white outline-none"
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-white/45">
                  Check the original ticket price and applicable transfer rules.
                </p>
              </div>

              <div>
                <label className={labelClass}>Ticket description *</label>
                <textarea
                  required
                  rows={5}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your ticket, quantity, transfer conditions, and other relevant information."
                  className={inputClass}
                />
                <p className="mt-2 text-right text-xs text-white/40">
                  {description.length}/2000 characters
                </p>
              </div>
            </div>
          </section>

          <section className={sectionClass}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d6b36a]">
              Ticket evidence
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#fffaf0]">
              Upload and analyze your ticket
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Upload a clear image, then analyze its visible text before submitting.
            </p>

            <label
              htmlFor="ticket-image"
              className="group mt-6 flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-[#d6b36a]/35 bg-[#d6b36a]/[0.035] px-5 py-9 text-center transition hover:border-[#d6b36a]/65 hover:bg-[#d6b36a]/[0.06]"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d6b36a]/25 bg-[#d6b36a]/[0.08] text-2xl text-[#e5ca91] transition group-hover:scale-105">
                ↑
              </span>
              <span className="mt-4 font-semibold text-[#fffaf0]">
                {ticketFile ? "Choose a different image" : "Upload ticket image"}
              </span>
              <span className="mt-2 break-all text-sm text-white/55">
                {ticketFile
                  ? ticketFile.name
                  : "Choose a JPG, PNG, or WebP image"}
              </span>
              <span className="mt-2 text-xs text-white/40">
                Maximum file size: 8 MB
              </span>
              <input
                ref={fileInputRef}
                id="ticket-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={(e) => {
                  setTicketFile(e.target.files?.[0] ?? null);
                  setMessage("");
                  resetCheck();
                }}
                className="sr-only"
              />
            </label>

            {ticketFile && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                <div className="min-w-0">
                  <p className="break-all text-sm font-medium text-white">
                    {ticketFile.name}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {(ticketFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTicketFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                    resetCheck();
                    setMessage("");
                  }}
                  className="text-xs text-white/60 underline underline-offset-4 hover:text-[#e5ca91]"
                >
                  Remove image
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => void analyzeTicket()}
              disabled={!ticketFile || isAnalyzing || loading}
              className="premium-button-secondary mt-5 w-full"
            >
              {isAnalyzing ? "Analyzing image..." : "Analyze ticket image"}
            </button>

            {checkStatus && (
              <div
                role="status"
                aria-live="polite"
                className={`mt-5 rounded-xl border p-5 ${
                  checkStatus === "matched"
                    ? "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-200"
                    : checkStatus === "review"
                      ? "border-amber-400/25 bg-amber-400/[0.06] text-amber-200"
                      : "border-red-400/25 bg-red-400/[0.06] text-red-200"
                }`}
              >
                <p className="font-semibold">
                  {statusDetails[checkStatus].title}
                </p>
                <p className="mt-2 text-sm leading-6 opacity-80">
                  {statusDetails[checkStatus].description}
                </p>

                {extractedText && (
                  <details className="mt-4 border-t border-white/10 pt-4">
                    <summary className="cursor-pointer text-sm font-medium">
                      View extracted text
                    </summary>
                    <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/20 p-3 text-xs leading-5">
                      {extractedText}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
              <p className="text-xs leading-6 text-white/55">
                <span className="font-semibold text-[#e5ca91]">
                  Important:
                </span>{" "}
                OCR checks visible text only. It cannot establish that a ticket
                is genuine, unused, or transferable. Listings remain pending
                review after submission.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[#d6b36a]/25 bg-[#d6b36a]/[0.045] p-5 sm:p-7">
            <h2 className="text-lg font-semibold text-[#fffaf0]">
              Ready to submit?
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Review your information before submitting your listing for review.
            </p>

            {message && (
              <div
                role="status"
                aria-live="polite"
                className="mt-5 break-words rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/80"
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={
                loading ||
                isAnalyzing ||
                !checkStatus ||
                checkStatus === "unreadable"
              }
              className="premium-button mt-6 w-full py-4 text-base"
            >
              {loading ? "Uploading and saving..." : "Submit listing for review"}
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-white/40">
              Ticket evidence is uploaded to private Supabase storage.
            </p>
          </section>
        </form>

        <footer className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/[0.08] pt-6 text-sm sm:flex-row">
          <p className="text-xs text-white/40">
            CineRelay · Your next experience starts here.
          </p>
          <Link
            href="/"
            className="text-white/60 transition hover:text-[#e5ca91]"
          >
            ← Back to marketplace
          </Link>
        </footer>
      </div>
    </main>
  );
}
