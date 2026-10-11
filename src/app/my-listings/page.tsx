
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Listing = {
  id: string;
  category: string;
  title: string;
  venue: string | null;
  location: string | null;
  price: number;
  status: string;
  created_at: string;
};

const categoryIcons: Record<string, string> = {
  Movies: "◈",
  Events: "✳",
  "Gift Cards": "◇",
  Trains: "↗",
  Buses: "⇄",
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

function getStatus(status: string) {
  switch (status.toLowerCase()) {
    case "approved":
      return {
        label: "Approved",
        description: "Visible in the marketplace",
        className:
          "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300",
        dot: "bg-emerald-300",
      };

    case "rejected":
      return {
        label: "Rejected",
        description: "Not approved for publication",
        className: "border-red-400/20 bg-red-400/[0.07] text-red-300",
        dot: "bg-red-300",
      };

    case "sold":
      return {
        label: "Sold",
        description: "Marked as sold",
        className: "border-sky-400/20 bg-sky-400/[0.07] text-sky-300",
        dot: "bg-sky-300",
      };

    case "pending":
      return {
        label: "Pending review",
        description: "Awaiting approval",
        className: "border-[#d6b36a]/25 bg-[#d6b36a]/[0.07] text-[#e5ca91]",
        dot: "bg-[#d6b36a]",
      };

    default:
      return {
        label: status || "Unknown",
        description: "Current listing status",
        className: "border-white/10 bg-white/[0.04] text-white/60",
        dot: "bg-white/50",
      };
  }
}

export default function MyListingsPage() {
  const router = useRouter();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadListings() {
      try {
        setLoading(true);
        setMessage("");

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
          router.replace(
            "/auth?mode=login&next=%2Fmy-listings"
          );
          return;
        }

        const { data, error } = await supabase
          .from("listings")
          .select(
            "id, category, title, venue, location, price, status, created_at"
          )
          .eq("seller_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (!cancelled) {
          setListings((data ?? []) as Listing[]);
        }
      } catch (error) {
        console.error("[CineRelay] Load listings failed:", error);

        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not load your listings."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadListings();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const approvedCount = listings.filter(
    (listing) => listing.status.toLowerCase() === "approved"
  ).length;

  const pendingCount = listings.filter(
    (listing) => listing.status.toLowerCase() === "pending"
  ).length;

  const soldCount = listings.filter(
    (listing) => listing.status.toLowerCase() === "sold"
  ).length;

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

          <nav className="flex items-center gap-3 sm:gap-5">
            <Link
              href="/messages"
              className="text-sm text-white/55 transition hover:text-[#e5ca91]"
            >
              Messages
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/65 transition hover:border-[#d6b36a]/35 hover:text-[#e5ca91]"
            >
              Explore
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-9 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-9 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d6b36a]/25 bg-[#d6b36a]/[0.06] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e5ca91]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#d6b36a]" />
              Seller dashboard
            </div>

            <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[#fffaf0] sm:text-5xl">
              My listings<span className="text-[#d6b36a]">.</span>
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-7 text-white/50 sm:text-base">
              Keep track of your tickets and vouchers, from submission
              to approval and beyond.
            </p>
          </div>

          <Link href="/sell" className="premium-button">
            <span className="mr-2 text-lg">+</span>
            Sell a ticket
          </Link>
        </div>

        {!loading && !message && (
          <div className="mb-9 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
                Total listings
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[#fffaf0]">
                {listings.length}
              </p>
              <p className="mt-2 text-xs text-white/35">
                All your submissions
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.025] p-4 sm:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
                Approved
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-emerald-300">
                {approvedCount}
              </p>
              <p className="mt-2 text-xs text-white/35">
                Visible listings
              </p>
            </div>

            <div className="rounded-2xl border border-[#d6b36a]/15 bg-[#d6b36a]/[0.025] p-4 sm:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
                Pending
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[#e5ca91]">
                {pendingCount}
              </p>
              <p className="mt-2 text-xs text-white/35">
                Awaiting review
              </p>
            </div>

            <div className="rounded-2xl border border-sky-400/15 bg-sky-400/[0.025] p-4 sm:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
                Sold
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-sky-300">
                {soldCount}
              </p>
              <p className="mt-2 text-xs text-white/35">
                Marked as sold
              </p>
            </div>
          </div>
        )}

        <div className="mb-6 flex items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <h2 className="text-base font-semibold text-[#fffaf0]">
              Your inventory
            </h2>
            <p className="mt-1 text-xs text-white/40">
              Most recently submitted first
            </p>
          </div>

          {!loading && !message && (
            <span className="rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-xs text-white/50">
              {listings.length}{" "}
              {listings.length === 1 ? "listing" : "listings"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8">
            <div
              className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-[#d6b36a]"
              aria-label="Loading listings"
            />
            <p className="mt-5 text-sm text-white/50">
              Loading your listings...
            </p>
          </div>
        ) : message ? (
          <div
            role="alert"
            className="rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-6 sm:p-9"
          >
            <h2 className="text-xl font-semibold text-[#fffaf0]">
              We couldn&apos;t load your listings
            </h2>
            <p className="mt-3 break-words text-sm leading-6 text-red-100/70">
              {message}
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="premium-button-secondary mt-5"
            >
              Try again
            </button>
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] px-6 py-14 text-center sm:px-12 sm:py-20">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#d6b36a]/25 bg-[#d6b36a]/[0.06] text-3xl text-[#e5ca91]">
              ◇
            </div>

            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d6b36a]">
              Your seller journey starts here
            </p>

            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#fffaf0]">
              No listings yet
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-white/50">
              Have an extra ticket or voucher? Create your first listing
              and keep track of its review status right here.
            </p>

            <Link href="/sell" className="premium-button mt-7">
              Create your first listing <span className="ml-2">↗</span>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {listings.map((listing) => {
              const status = getStatus(listing.status);

              return (
                <article
                  key={listing.id}
                  className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101114] transition duration-200 hover:border-[#d6b36a]/30 hover:bg-white/[0.025]"
                >
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-xs text-white/55">
                        <span className="text-[#e5ca91]">
                          {categoryIcons[listing.category] ?? "◈"}
                        </span>
                        {listing.category}
                      </span>

                      <span
                        className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold ${status.className}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                        />
                        {status.label}
                      </span>
                    </div>

                    <h3 className="mt-5 break-words text-xl font-semibold leading-snug tracking-[-0.025em] text-[#fffaf0] transition group-hover:text-[#e5ca91]">
                      {listing.title}
                    </h3>

                    {(listing.venue || listing.location) && (
                      <div className="mt-3 space-y-2">
                        {listing.venue && (
                          <p className="flex items-start gap-2 text-sm leading-5 text-white/50">
                            <span className="text-[#d6b36a]">⌖</span>
                            <span className="break-words">
                              {listing.venue}
                            </span>
                          </p>
                        )}

                        {listing.location && (
                          <p className="flex items-start gap-2 text-sm leading-5 text-white/40">
                            <span className="text-[#d6b36a]">↗</span>
                            <span className="break-words">
                              {listing.location}
                            </span>
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-white/[0.07] pt-5">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">
                          Asking price
                        </p>
                        <p className="mt-2 text-2xl font-semibold tracking-tight text-[#e5ca91]">
                          {formatPrice(Number(listing.price))}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">
                          Submitted
                        </p>
                        <p className="mt-2 text-xs text-white/60">
                          {formatDate(listing.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] bg-white/[0.015] px-5 py-3.5 sm:px-6">
                    <p className="text-xs text-white/40">
                      {status.description}
                    </p>

                    {listing.status.toLowerCase() === "approved" && (
                      <Link
                        href={`/listing/${encodeURIComponent(listing.id)}`}
                        className="shrink-0 text-xs font-semibold text-[#e5ca91] transition hover:text-white"
                      >
                        View listing →
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-6">
          <Link
            href="/"
            className="text-sm text-white/45 transition hover:text-[#e5ca91]"
          >
            ← Back to marketplace
          </Link>

          <p className="text-xs text-white/30">
            CineRelay · Pass the experience on.
          </p>
        </div>
      </section>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-white/35 sm:px-6 lg:px-8">
          <span className="font-semibold text-white/65">
            Cine<span className="font-light text-[#d6b36a]">Relay</span>
          </span>
          <span>© 2026 CineRelay. All rights reserved.</span>
        </div>
      </footer>
    </main>
  );
}
