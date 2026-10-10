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

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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
          setError("Please log in to view your messages.");
          return;
        }

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
          .order("created_at", { ascending: false });

        if (queryError) throw queryError;

        setConversations((data ?? []) as unknown as Conversation[]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your conversations."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadConversations();
  }, []);

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5">
          <Link href="/" className="text-2xl font-black">
            <span className="text-amber-400">◈</span> CineRelay
          </Link>

          <Link
            href="/"
            className="text-sm text-gray-300 hover:text-amber-400"
          >
            ← Explore tickets
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-400">
            Your conversations
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Messages
          </h1>
          <p className="mt-3 text-gray-400">
            Talk to buyers and sellers about their ticket listings.
          </p>
        </div>

        {loading ? (
          <p className="mt-10 text-gray-400">
            Loading your conversations...
          </p>
        ) : error ? (
          <div
            role="alert"
            className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5"
          >
            <p className="text-red-300">{error}</p>

            {error.includes("log in") && (
              <Link
                href="/auth?mode=login"
                className="mt-4 inline-block rounded-xl bg-amber-400 px-5 py-3 font-bold text-black hover:bg-amber-300"
              >
                Log in
              </Link>
            )}
          </div>
        ) : conversations.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <div className="text-6xl">💬</div>
            <h2 className="mt-5 text-xl font-bold">
              No conversations yet
            </h2>
            <p className="mx-auto mt-3 max-w-md leading-7 text-gray-400">
              Open an approved ticket listing and choose Chat with Seller
              to start your first conversation.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-amber-400 px-5 py-3 font-bold text-black hover:bg-amber-300"
            >
              Explore tickets
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {conversations.map((conversation) => {
              const isBuyer = conversation.buyer_id === userId;
              const otherPerson = isBuyer ? "Seller" : "Buyer";
              const listing = conversation.listings;

              return (
                <Link
                  key={conversation.id}
                  href={`/messages/${conversation.id}`}
                  className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-amber-400/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-2xl">
                      💬
                    </div>

                    <div className="min-w-0">
                      <h2 className="break-words font-bold">
                        {listing?.title ?? "Ticket listing"}
                      </h2>

                      <p className="mt-1 text-sm text-gray-400">
                        {listing?.category ?? "Listing"} · {otherPerson}
                      </p>

                      {listing && (
                        <p className="mt-2 font-semibold text-amber-400">
                          ₹{Number(listing.price).toLocaleString("en-IN")}
                        </p>
                      )}

                      <p className="mt-2 text-xs text-gray-500">
                        Started{" "}
                        {new Date(
                          conversation.created_at
                        ).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 text-sm font-semibold text-amber-400">
                    Open chat →
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <footer className="border-t border-white/10 px-5 py-6 text-center text-sm text-gray-500">
        © 2026 CineRelay. All rights reserved.
      </footer>
    </main>
  );
}