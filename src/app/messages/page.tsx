
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Conversation = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
  listings: {
    title: string;
    category: string;
    price: number;
  } | null;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(price));
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadConversations() {
      try {
        setLoading(true);
        setError("");

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
          if (!cancelled) {
            setError("Please log in to view your messages.");
          }
          return;
        }

        if (cancelled) return;
        setUserId(user.id);

        const { data, error: queryError } = await supabase
          .from("chat_conversations")
          .select(`
            id,
            listing_id,
            buyer_id,
            seller_id,
            created_at,
            listings (
              title,
              category,
              price
            )
          `)
          .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
          .order("created_at", { ascending: false });

        if (queryError) throw queryError;

        if (!cancelled) {
          setConversations((data ?? []) as unknown as Conversation[]);
        }
      } catch (err) {
        console.error("[CineRelay] Load conversations failed:", err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your conversations."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadConversations();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#090a0c] text-[#f5f2eb]">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#090a0c]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d6b36a]/30 bg-[#d6b36a]/[0.08] text-xl text-[#e5ca91]">
              ◈
            </span>
            <span className="text-lg font-semibold tracking-[-0.04em] sm:text-xl">
              Cine<span className="font-light text-[#d6b36a]">Relay</span>
            </span>
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/65 transition hover:border-[#d6b36a]/40 hover:text-[#e5ca91]"
          >
            ← Explore tickets
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-9 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-9">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d6b36a]/25 bg-[#d6b36a]/[0.06] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e5ca91]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d6b36a]" />
            Your inbox
          </div>

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[#fffaf0] sm:text-5xl">
                Messages<span className="text-[#d6b36a]">.</span>
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/55 sm:text-base">
                Every ticket has a story. Connect with buyers and sellers to
                discuss the details.
              </p>
            </div>

            {!loading && !error && (
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
                <span className="text-2xl font-semibold text-[#e5ca91]">
                  {conversations.length}
                </span>
                <span className="text-xs leading-5 text-white/50">
                  {conversations.length === 1
                    ? "Conversation"
                    : "Conversations"}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between border-b border-white/[0.08] pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
            Recent conversations
          </p>
          <span className="text-xs text-white/30">
            Latest first
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8">
            <div
              className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-[#d6b36a]"
              aria-label="Loading conversations"
            />
            <p className="mt-5 text-sm text-white/50">
              Loading your conversations...
            </p>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-6 sm:p-9"
          >
            <span className="text-2xl text-red-200">!</span>
            <h2 className="mt-3 text-xl font-semibold text-[#fffaf0]">
              We couldn&apos;t open your inbox
            </h2>
            <p className="mt-3 break-words text-sm leading-6 text-red-100/70">
              {error}
            </p>

            {error.toLowerCase().includes("log in") && (
              <Link
                href="/auth?mode=login&next=%2Fmessages"
                className="premium-button mt-5"
              >
                Log in to CineRelay
              </Link>
            )}

            {!error.toLowerCase().includes("log in") && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="premium-button-secondary mt-5"
              >
                Try again
              </button>
            )}
          </div>
        ) : conversations.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] px-6 py-14 text-center sm:px-12 sm:py-20">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#d6b36a]/25 bg-[#d6b36a]/[0.07] text-3xl text-[#e5ca91]">
              ◇
            </div>

            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d6b36a]">
              Your next conversation starts here
            </p>

            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#fffaf0]">
              No conversations yet
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-white/50">
              Found a ticket you like? Open an approved listing and choose
              Message seller to start a conversation.
            </p>

            <Link href="/" className="premium-button mt-7">
              Explore tickets <span className="ml-2">↗</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation) => {
              const isBuyer = conversation.buyer_id === userId;
              const listing = conversation.listings;

              return (
                <Link
                  key={conversation.id}
                  href={`/messages/${encodeURIComponent(conversation.id)}`}
                  className="group flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#101114] p-4 transition duration-200 hover:border-[#d6b36a]/35 hover:bg-white/[0.035] sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#d6b36a]/20 bg-[#d6b36a]/[0.07] text-xl text-[#e5ca91] transition group-hover:bg-[#d6b36a]/[0.12]">
                      ◇
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className="break-words text-base font-semibold text-[#fffaf0] transition group-hover:text-[#e5ca91]">
                        {listing?.title ?? "Ticket listing"}
                      </h2>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
                        <span>{listing?.category ?? "Listing"}</span>
                        <span className="text-white/20">·</span>
                        <span>{isBuyer ? "Seller" : "Buyer"}</span>
                      </div>

                      {listing && (
                        <p className="mt-3 text-sm font-semibold text-[#e5ca91]">
                          {formatPrice(Number(listing.price))}
                        </p>
                      )}

                      <p className="mt-2 text-xs text-white/35">
                        Started {formatDate(conversation.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3 sm:shrink-0 sm:justify-end sm:border-0 sm:pt-0">
                    <span className="text-xs text-white/35 sm:hidden">
                      Open this conversation
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/70 transition group-hover:border-[#d6b36a]/35 group-hover:text-[#e5ca91]">
                      Open chat <span>→</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.015] p-4 sm:p-5">
          <p className="text-xs leading-6 text-white/40">
            <span className="font-semibold text-[#e5ca91]">
              Stay safe:
            </span>{" "}
            Never share passwords or OTPs. Confirm ticket transfer eligibility
            before sending payment.
          </p>
        </div>
      </section>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-7 text-xs text-white/35 sm:px-6 lg:px-8">
          <Link href="/" className="font-semibold text-white/70">
            Cine<span className="font-light text-[#d6b36a]">Relay</span>
          </Link>
          <p>© 2026 CineRelay. All rights reserved.</p>
          <Link
            href="/my-listings"
            className="transition hover:text-[#e5ca91]"
          >
            My listings →
          </Link>
        </div>
      </footer>
    </main>
  );
}
