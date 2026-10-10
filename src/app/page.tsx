
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import MessageNotifications from "@/components/MessageNotifications";

type Listing = {
  id: string;
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

const categories = [
  "All",
  "Movies",
  "Events",
  "Gift Cards",
  "Trains",
  "Buses",
];

const categoryIcons: Record<string, string> = {
  Movies: "🎬",
  Events: "🎟️",
  "Gift Cards": "🎁",
  Trains: "🚆",
  Buses: "🚌",
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(price);
}

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadListings = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("listings")
      .select(
        "id, title, category, venue, location, price, description, event_date, event_time, status, created_at"
      )
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load listings:", error);
      setErrorMessage(
        "We couldn't load listings right now. Please try again."
      );
      setListings([]);
    } else {
      setListings((data ?? []) as Listing[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();

    return listings.filter((listing) => {
      const matchesCategory =
        selectedCategory === "All" ||
        listing.category === selectedCategory;

      const searchableText = [
        listing.title,
        listing.category,
        listing.venue ?? "",
        listing.location ?? "",
        listing.description ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return matchesCategory && (!query || searchableText.includes(query));
    });
  }, [listings, selectedCategory, search]);

  return (
    <main className="min-h-screen bg-[#080d19] text-white">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080d19]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-xl font-black text-black">
              C
            </span>
            <span className="text-xl font-extrabold tracking-tight">
              Cine<span className="text-amber-400">Relay</span>
            </span>
          </Link>

          <nav className="flex items-center gap-3 text-sm sm:gap-5">
            <Link
              href="/my-listings"
              className="hidden text-gray-300 transition hover:text-amber-400 sm:inline"
            >
              My Listings
            </Link>

            <MessageNotifications />

            <Link
              href="/auth"
              className="hidden text-gray-300 transition hover:text-amber-400 sm:inline"
            >
              Login
            </Link>

            <Link
              href="/sell"
              className="rounded-lg bg-amber-400 px-4 py-2.5 font-bold text-black transition hover:bg-amber-300"
            >
              + Sell Ticket
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="pointer-events-none absolute -top-36 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-5 py-16 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-300">
              <span>✦</span>
              <span>Your ticket. Someone else&apos;s next experience.</span>
            </div>

            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl">
              Don&apos;t let your tickets
              <span className="block text-amber-400">
                go to waste.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-gray-400 sm:text-lg">
              Discover tickets from other fans, find better deals, and
              connect with sellers through CineRelay.
            </p>

            {/* Search */}
            <form
              className="mx-auto mt-9 flex max-w-2xl flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                document
                  .getElementById("marketplace")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <div className="flex flex-1 items-center gap-3 px-3">
                <span className="text-xl text-gray-400">⌕</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search movies, events, locations..."
                  aria-label="Search listings"
                  className="w-full bg-transparent py-3 text-white outline-none placeholder:text-gray-500"
                />
              </div>

              <button
                type="submit"
                className="rounded-xl bg-amber-400 px-7 py-3 font-bold text-black transition hover:bg-amber-300"
              >
                Find Tickets
              </button>
            </form>

            <p className="mt-4 text-xs text-gray-500">
              Browse available listings and contact sellers directly.
            </p>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-5 pt-10 lg:px-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold sm:text-2xl">
            Explore Categories
          </h2>
          <span className="text-sm text-gray-500">
            Find your next experience
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.slice(1).map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                setSelectedCategory(category);
                document
                  .getElementById("marketplace")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`rounded-2xl border p-5 text-left transition ${
                selectedCategory === category
                  ? "border-amber-400 bg-amber-400/10"
                  : "border-white/10 bg-white/[0.03] hover:border-amber-400/50 hover:bg-white/[0.06]"
              }`}
            >
              <span className="text-3xl">
                {categoryIcons[category]}
              </span>
              <span className="mt-3 block font-bold">{category}</span>
              <span className="mt-1 block text-xs text-gray-500">
                Explore listings →
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Marketplace */}
      <section
        id="marketplace"
        className="mx-auto max-w-7xl px-5 py-14 lg:px-8"
      >
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
              The Marketplace
            </p>
            <h2 className="text-2xl font-black sm:text-3xl">
              Available Tickets
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Browse approved listings from CineRelay sellers.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  selectedCategory === category
                    ? "border-amber-400 bg-amber-400 text-black"
                    : "border-white/10 text-gray-300 hover:border-amber-400/50"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-red-200"
          >
            <p>{errorMessage}</p>
            <button
              type="button"
              onClick={() => void loadListings()}
              className="mt-3 font-bold underline"
            >
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <div className="h-5 w-2/3 rounded bg-white/10" />
                <div className="mt-4 h-4 w-1/2 rounded bg-white/10" />
                <div className="mt-8 h-10 rounded bg-white/10" />
              </div>
            ))}
          </div>
        ) : !errorMessage && filteredListings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center">
            <div className="text-5xl">🎟️</div>
            <h3 className="mt-5 text-xl font-bold">
              No tickets found
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-400">
              {search || selectedCategory !== "All"
                ? "Try a different search or category."
                : "There are no approved listings yet. Be the first to list a ticket."}
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("All");
                }}
                className="rounded-lg border border-white/15 px-5 py-3 font-semibold hover:border-amber-400"
              >
                Clear Filters
              </button>

              <Link
                href="/sell"
                className="rounded-lg bg-amber-400 px-5 py-3 font-bold text-black hover:bg-amber-300"
              >
                Sell a Ticket
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredListings.map((listing) => (
              <article
                key={listing.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1423] transition hover:-translate-y-1 hover:border-amber-400/40"
              >
                <div className="flex items-start justify-between gap-3 border-b border-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-2xl">
                      {categoryIcons[listing.category] ?? "🎟️"}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                        {listing.category}
                      </p>
                      <h3 className="mt-1 line-clamp-2 font-bold leading-5">
                        {listing.title}
                      </h3>
                    </div>
                  </div>

                  <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300">
                    Available
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  {listing.venue && (
                    <p className="text-sm text-gray-300">
                      <span className="mr-2">📍</span>
                      {listing.venue}
                    </p>
                  )}

                  {listing.location && (
                    <p className="mt-2 text-sm text-gray-400">
                      <span className="mr-2">🌍</span>
                      {listing.location}
                    </p>
                  )}

                  {(listing.event_date || listing.event_time) && (
                    <p className="mt-2 text-sm text-gray-400">
                      <span className="mr-2">🗓️</span>
                      {[
                        listing.event_date
                          ? new Date(
                              `${listing.event_date}T00:00:00`
                            ).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : null,
                        listing.event_time,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}

                  {listing.description && (
                    <p className="mt-4 line-clamp-3 text-sm leading-6 text-gray-400">
                      {listing.description}
                    </p>
                  )}

                  <div className="mt-auto pt-6">
                    <div className="mb-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-500">
                          Seller&apos;s asking price
                        </p>
                        <p className="mt-1 text-2xl font-black text-amber-400">
                          {formatPrice(Number(listing.price))}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/listing/${listing.id}`}
                      className="block w-full rounded-xl bg-amber-400 px-4 py-3 text-center font-bold text-black transition hover:bg-amber-300"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Sell CTA */}
      <section className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-amber-400/20 bg-gradient-to-r from-amber-400/10 to-transparent p-7 sm:flex-row sm:items-center sm:p-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-amber-400">
              Have an unused ticket?
            </p>
            <h2 className="mt-3 text-2xl font-black sm:text-3xl">
              Give your ticket another chance.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-400">
              Submit your listing for review and connect with interested
              buyers after approval.
            </p>
          </div>

          <Link
            href="/sell"
            className="shrink-0 rounded-xl bg-amber-400 px-6 py-3.5 font-bold text-black transition hover:bg-amber-300"
          >
            List Your Ticket →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <Link href="/" className="font-bold text-white">
            Cine<span className="text-amber-400">Relay</span>
          </Link>

          <p>
            Discover. Connect. Relay.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/messages"
              className="transition hover:text-amber-400"
            >
              Messages
            </Link>
            <Link
              href="/my-listings"
              className="transition hover:text-amber-400"
            >
              My Listings
            </Link>
            <Link
              href="/auth"
              className="transition hover:text-amber-400"
            >
              Account
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
