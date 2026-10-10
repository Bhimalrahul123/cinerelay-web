
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Listing = {
  id: string;
  seller_id: string;
  title: string;
  category: string;
  venue: string | null;
  location: string | null;
  price: number;
  description: string | null;
  event_date: string | null;
  event_time: string | null;
  status: string;
  created_at: string;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(price);
}

export default function ListingDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const listingId = params.id;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  const loadListing = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: listingError } = await supabase
      .from("listings")
      .select(
        "id, seller_id, title, category, venue, location, price, description, event_date, event_time, status, created_at"
      )
      .eq("id", listingId)
      .eq("status", "approved")
      .maybeSingle();

    if (listingError) {
      console.error("Listing load error:", listingError);
      setError("Unable to load this ticket. Please try again.");
      setListing(null);
    } else if (!data) {
      setError("This ticket is unavailable or has been removed.");
      setListing(null);
    } else {
      setListing(data as Listing);
    }

    setLoading(false);
  }, [listingId]);

  useEffect(() => {
    void loadListing();
  }, [loadListing]);

  async function handleChat() {
    setChatLoading(true);
    setChatError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/auth");
        return;
      }

      if (user.id === listing?.seller_id) {
        setChatError("You cannot start a chat with yourself.");
        return;
      }

      const { data: conversationId, error: rpcError } =
        await supabase.rpc("open_listing_chat", {
          p_listing_id: listing!.id,
        });

      if (rpcError) {
        console.error("Open chat error:", rpcError);
        setChatError(
          "Could not open this chat. Please check that the listing is available and try again."
        );
        return;
      }

      if (!conversationId) {
        setChatError("The chat could not be created. Please try again.");
        return;
      }

      router.push(`/messages/${conversationId}`);
    } catch (err) {
      console.error("Chat error:", err);
      setChatError("Something went wrong. Please try again.");
    } finally {
      setChatLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080d19] px-5 text-white">
        <p className="animate-pulse text-gray-400">
          Loading ticket details...
        </p>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="min-h-screen bg-[#080d19] px-5 py-16 text-white">
        <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#0d1423] p-8 text-center">
          <div className="text-5xl">🎟️</div>
          <h1 className="mt-4 text-2xl font-bold">
            Ticket unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-400">
            {error || "We couldn't find this listing."}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-amber-400 px-6 py-3 font-bold text-black hover:bg-amber-300"
          >
            Back to Marketplace
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080d19] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-xl font-extrabold">
            Cine<span className="text-amber-400">Relay</span>
          </Link>

          <Link
            href="/messages"
            className="text-sm text-gray-300 transition hover:text-amber-400"
          >
            Messages
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:py-12">
        <Link
          href="/"
          className="text-sm text-gray-400 transition hover:text-amber-400"
        >
          ← Back to Marketplace
        </Link>

        <div className="mt-7 grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <section className="rounded-3xl border border-white/10 bg-[#0d1423] p-6 sm:p-8">
            <span className="inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
              {listing.category}
            </span>

            <h1 className="mt-5 text-3xl font-black leading-tight sm:text-4xl">
              {listing.title}
            </h1>

            <div className="mt-7 space-y-4">
              {listing.venue && (
                <div className="flex gap-3">
                  <span className="text-xl">📍</span>
                  <div>
                    <p className="text-xs text-gray-500">Venue</p>
                    <p className="mt-1 font-medium">{listing.venue}</p>
                  </div>
                </div>
              )}

              {listing.location && (
                <div className="flex gap-3">
                  <span className="text-xl">🌍</span>
                  <div>
                    <p className="text-xs text-gray-500">Location</p>
                    <p className="mt-1 font-medium">{listing.location}</p>
                  </div>
                </div>
              )}

              {(listing.event_date || listing.event_time) && (
                <div className="flex gap-3">
                  <span className="text-xl">🗓️</span>
                  <div>
                    <p className="text-xs text-gray-500">Date and time</p>
                    <p className="mt-1 font-medium">
                      {listing.event_date
                        ? new Date(
                            `${listing.event_date}T00:00:00`
                          ).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "Date not specified"}
                      {listing.event_time
                        ? ` · ${listing.event_time}`
                        : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 border-t border-white/10 pt-7">
              <h2 className="text-lg font-bold">About this ticket</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-300">
                {listing.description || "No additional description provided."}
              </p>
            </div>

            <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold">Before you purchase</p>
              <p className="mt-2 text-sm leading-6 text-gray-400">
                Confirm the event details and ticket transfer eligibility.
                Payment confirmation alone does not guarantee ticket transfer.
              </p>
            </div>
          </section>

          <aside className="h-fit rounded-3xl border border-white/10 bg-[#0d1423] p-6 sm:p-8 lg:sticky lg:top-6">
            <p className="text-sm text-gray-400">Seller&apos;s asking price</p>

            <p className="mt-2 text-4xl font-black text-amber-400">
              {formatPrice(Number(listing.price))}
            </p>

            <p className="mt-3 text-xs leading-5 text-gray-500">
              The final checkout amount is calculated on the server from the
              listing price.
            </p>

            <div className="mt-7 space-y-3">
              <Link
                href={`/checkout/${listing.id}`}
                className="block w-full rounded-xl bg-amber-400 px-5 py-3.5 text-center font-bold text-black transition hover:bg-amber-300"
              >
                Buy Now · {formatPrice(Number(listing.price))}
              </Link>

              <button
                type="button"
                onClick={() => void handleChat()}
                disabled={chatLoading}
                className="block w-full rounded-xl border border-white/15 px-5 py-3.5 text-center font-bold transition hover:border-amber-400 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {chatLoading ? "Opening chat..." : "Chat with Seller"}
              </button>
            </div>

            {chatError && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200"
              >
                {chatError}
              </p>
            )}

            <div className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm text-gray-400">
              <p className="flex items-center gap-2">
                <span className="text-amber-400">✓</span>
                Server-verified payment flow
              </p>
              <p className="flex items-center gap-2">
                <span className="text-amber-400">✓</span>
                Contact the seller before buying
              </p>
              <p className="flex items-center gap-2">
                <span className="text-amber-400">✓</span>
                Order status tracked in the database
              </p>
            </div>
          </aside>
        </div>
      </div>

      <footer className="mt-10 border-t border-white/10 px-5 py-7 text-center text-sm text-gray-500">
        CineRelay · Discover. Connect. Relay.
      </footer>
    </main>
  );
}
