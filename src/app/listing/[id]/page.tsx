"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Listing = {
  id: string;
  category: string;
  title: string;
  venue: string | null;
  location: string | null;
  price: number;
  description: string;
  event_date: string | null;
  event_time: string | null;
  created_at: string;
};

const categoryIcons: Record<string, string> = {
  Movies: "🎬",
  Events: "🎟️",
  "Gift Cards": "🎁",
  Trains: "🚆",
  Buses: "🚌",
};

export default function ListingDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingChat, setStartingChat] = useState(false);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadListing() {
      try {
        setLoading(true);
        setError("");

        const { data, error: fetchError } = await supabase
          .from("listings")
          .select(
            "id, category, title, venue, location, price, description, event_date, event_time, created_at"
          )
          .eq("id", id)
          .eq("status", "approved")
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (active) {
          setListing(data as Listing | null);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load this listing."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    if (id) void loadListing();

    return () => {
      active = false;
    };
  }, [id]);

  async function handleChatWithSeller() {
    if (!listing || startingChat) return;

    setStartingChat(true);
    setChatError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        router.push(
          `/auth?mode=login&next=${encodeURIComponent(
            `/listing/${listing.id}`
          )}`
        );
        return;
      }

      const { data, error: rpcError } = await supabase.rpc(
        "open_listing_chat",
        {
          p_listing_id: listing.id,
        }
      );

      if (rpcError) {
        console.error("CineRelay chat error:", rpcError);
        throw new Error(rpcError.message);
      }

      if (!data || typeof data !== "string") {
        throw new Error("Could not open the conversation. Please try again.");
      }

      router.push(`/messages/${data}`);
    } catch (err) {
      setChatError(
        err instanceof Error
          ? err.message
          : "Unable to start the conversation. Please try again."
      );
      setStartingChat(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      {/* Navigation */}
      <header className="border-b border-white/10 bg-[#080b12]/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
          <Link href="/" className="text-2xl font-black">
            <span className="text-amber-400">◈</span> CineRelay
          </Link>

          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link
              href="/"
              className="text-gray-300 hover:text-amber-400"
            >
              Explore
            </Link>
            <Link
              href="/messages"
              className="text-gray-300 hover:text-amber-400"
            >
              Messages
            </Link>
            <Link
              href="/my-listings"
              className="text-gray-300 hover:text-amber-400"
            >
              My Listings
            </Link>
          </nav>
        </div>
      </header>

      {/* Listing details */}
      <section className="mx-auto max-w-5xl px-5 py-12">
        {loading ? (
          <div className="py-20 text-center text-gray-400">
            Loading ticket details...
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6"
          >
            <h1 className="text-xl font-bold">
              Unable to load listing
            </h1>
            <p className="mt-3 break-words text-sm text-red-300">
              {error}
            </p>
            <Link
              href="/"
              className="mt-5 inline-block text-amber-400 hover:text-amber-300"
            >
              ← Back to Explore
            </Link>
          </div>
        ) : !listing ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <div className="text-6xl">🎟️</div>
            <h1 className="mt-5 text-2xl font-black">
              Listing unavailable
            </h1>
            <p className="mt-3 text-gray-400">
              This listing may not exist or may no longer be approved.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-amber-400 px-5 py-3 font-bold text-black hover:bg-amber-300"
            >
              Explore other listings
            </Link>
          </div>
        ) : (
          <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
            {/* Ticket banner */}
            <div className="relative flex min-h-56 items-center justify-center overflow-hidden bg-gradient-to-br from-amber-400/20 via-orange-500/10 to-transparent sm:min-h-72">
              <div className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
              <span className="relative text-8xl">
                {categoryIcons[listing.category] ?? "🎟️"}
              </span>
            </div>

            <div className="p-6 sm:p-10">
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-sm text-amber-300">
                {listing.category}
              </span>

              <h1 className="mt-5 break-words text-3xl font-black sm:text-4xl">
                {listing.title}
              </h1>

              <p className="mt-5 text-4xl font-black text-amber-400">
                ₹{Number(listing.price).toLocaleString("en-IN")}
              </p>

              {/* Ticket information */}
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {listing.venue && (
                  <div className="rounded-2xl border border-white/10 bg-[#111722] p-4">
                    <p className="text-sm text-gray-400">Venue</p>
                    <p className="mt-2 break-words font-semibold">
                      {listing.venue}
                    </p>
                  </div>
                )}

                {listing.location && (
                  <div className="rounded-2xl border border-white/10 bg-[#111722] p-4">
                    <p className="text-sm text-gray-400">Location</p>
                    <p className="mt-2 break-words font-semibold">
                      {listing.location}
                    </p>
                  </div>
                )}

                {listing.event_date && (
                  <div className="rounded-2xl border border-white/10 bg-[#111722] p-4">
                    <p className="text-sm text-gray-400">Event date</p>
                    <p className="mt-2 font-semibold">
                      {new Date(
                        `${listing.event_date}T00:00:00`
                      ).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}

                {listing.event_time && (
                  <div className="rounded-2xl border border-white/10 bg-[#111722] p-4">
                    <p className="text-sm text-gray-400">Event time</p>
                    <p className="mt-2 font-semibold">
                      {listing.event_time}
                    </p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mt-8">
                <h2 className="text-xl font-bold">
                  Ticket description
                </h2>
                <p className="mt-3 whitespace-pre-wrap break-words leading-7 text-gray-300">
                  {listing.description}
                </p>
              </div>

              {/* Buyer-seller chat */}
              <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-2xl">
                    💬
                  </div>

                  <div className="flex-1">
                    <h2 className="text-lg font-bold">
                      Interested in this ticket?
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-gray-400">
                      Chat privately with the seller to clarify ticket
                      details, availability, and transfer eligibility
                      before deciding whether to proceed.
                    </p>
                  </div>
                </div>

                {chatError && (
                  <p
                    role="alert"
                    className="mt-4 break-words rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"
                  >
                    {chatError}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={`/checkout/${listing.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3.5 font-bold text-black transition hover:bg-amber-300"
                  >
                    <span>⚡</span>
                    Buy Now · ₹{Number(listing.price).toLocaleString("en-IN")}
                  </Link>

                  <button
                    type="button"
                    onClick={handleChatWithSeller}
                    disabled={startingChat}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3.5 font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {startingChat ? (
                      "Opening conversation..."
                    ) : (
                      <>
                        <span>💬</span>
                        Chat with Seller
                      </>
                    )}
                  </button>
                </div>

                <p className="mt-3 text-xs leading-5 text-gray-500">
                  Never share passwords or OTPs. Confirm the issuer&apos;s
                  transfer rules before making a payment.
                </p>
              </div>

              {/* Footer information */}
              <p className="mt-6 text-xs text-gray-500">
                Listed{" "}
                {new Date(listing.created_at).toLocaleDateString("en-IN")}
              </p>

              <Link
                href="/"
                className="mt-6 inline-block rounded-xl border border-white/15 px-5 py-3 font-semibold transition hover:border-amber-400 hover:text-amber-400"
              >
                ← Browse more tickets
              </Link>
            </div>
          </article>
        )}
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-7 text-sm text-gray-500">
          <Link href="/" className="font-bold text-amber-400">
            ◈ CineRelay
          </Link>
          <p>© 2026 CineRelay. All rights reserved.</p>
          <Link
            href="/messages"
            className="hover:text-amber-400"
          >
            Messages
          </Link>
        </div>
      </footer>
    </main>
  );
}