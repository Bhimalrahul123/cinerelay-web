
"use client";

import { useEffect, useState } from "react";
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

export default function MyListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadListings() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          window.location.href = "/auth?mode=login";
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

        setListings((data ?? []) as Listing[]);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not load your listings."
        );
      } finally {
        setLoading(false);
      }
    }

    loadListings();
  }, []);

  function statusStyle(status: string) {
    switch (status) {
      case "approved":
        return "border-green-500/30 bg-green-500/10 text-green-400";
      case "rejected":
        return "border-red-500/30 bg-red-500/10 text-red-400";
      case "sold":
        return "border-blue-500/30 bg-blue-500/10 text-blue-400";
      default:
        return "border-amber-500/30 bg-amber-500/10 text-amber-400";
    }
  }

  return (
    <main className="min-h-screen bg-[#080b12] px-5 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <a href="/" className="font-bold text-amber-400">
          ◈ CineRelay
        </a>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black sm:text-4xl">
              My Listings
            </h1>
            <p className="mt-2 text-gray-400">
              Track the tickets and vouchers you have submitted.
            </p>
          </div>

          <a
            href="/sell"
            className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-black"
          >
            + Sell a ticket
          </a>
        </div>

        {loading ? (
          <p className="mt-10 text-gray-400">Loading your listings...</p>
        ) : message ? (
          <p
            role="alert"
            className="mt-8 break-words rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300"
          >
            {message}
          </p>
        ) : listings.length === 0 ? (
          <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <h2 className="text-xl font-bold">No listings yet</h2>
            <p className="mt-3 text-gray-400">
              Your submitted tickets will appear here.
            </p>
            <a
              href="/sell"
              className="mt-6 inline-block rounded-xl bg-amber-400 px-5 py-3 font-bold text-black"
            >
              Create your first listing
            </a>
          </section>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {listings.map((listing) => (
              <article
                key={listing.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm text-gray-400">
                    {listing.category}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusStyle(
                      listing.status
                    )}`}
                  >
                    {listing.status}
                  </span>
                </div>

                <h2 className="mt-4 text-xl font-bold">
                  {listing.title}
                </h2>

                {listing.venue && (
                  <p className="mt-2 text-sm text-gray-400">
                    Venue: {listing.venue}
                  </p>
                )}

                {listing.location && (
                  <p className="mt-1 text-sm text-gray-400">
                    Location: {listing.location}
                  </p>
                )}

                <p className="mt-4 text-2xl font-black text-amber-400">
                  ₹{Number(listing.price).toLocaleString("en-IN")}
                </p>

                <p className="mt-3 text-xs text-gray-500">
                  Submitted{" "}
                  {new Date(listing.created_at).toLocaleDateString("en-IN")}
                </p>
              </article>
            ))}
          </div>
        )}

        <a
          href="/"
          className="mt-8 inline-block text-sm text-gray-400 hover:text-amber-400"
        >
          ← Back to homepage
        </a>
      </div>
    </main>
  );
}
