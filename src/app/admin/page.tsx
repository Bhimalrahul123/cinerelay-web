
"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Listing = {
  id: string;
  seller_id: string;
  category: string;
  title: string;
  venue: string | null;
  location: string | null;
  price: number;
  description: string;
  created_at: string;
  evidence_path: string | null;
  evidence_url: string | null;
};

export default function AdminPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const loadListings = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        window.location.href = "/auth?mode=login";
        return;
      }

      const { data, error } = await supabase.rpc(
        "admin_get_pending_listings"
      );

      if (error) throw error;

      const pendingRows = (data ?? []) as Omit<
        Listing,
        "evidence_url"
      >[];

      // Create short-lived signed URLs for private ticket images.
      const rowsWithImages = await Promise.all(
        pendingRows.map(async (listing) => {
          if (!listing.evidence_path) {
            return { ...listing, evidence_url: null };
          }

          const { data: signedData, error: signedError } =
            await supabase.storage
              .from("ticket-evidence")
              .createSignedUrl(listing.evidence_path, 300);

          if (signedError) {
            console.error(
              "Could not create ticket preview URL:",
              signedError.message
            );
            return { ...listing, evidence_url: null };
          }

          return {
            ...listing,
            evidence_url: signedData.signedUrl,
          };
        })
      );

      setIsAdmin(true);
      setListings(rowsWithImages);
    } catch (error) {
      setIsAdmin(false);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load admin listings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  async function updateStatus(
    listingId: string,
    action: "approve" | "reject"
  ) {
    const confirmed = window.confirm(
      action === "approve"
        ? "Approve this listing for publication?"
        : "Reject this listing?"
    );

    if (!confirmed) return;

    setWorkingId(listingId);
    setMessage("");

    try {
      const functionName =
        action === "approve"
          ? "admin_approve_listing"
          : "admin_reject_listing";

      const { error } = await supabase.rpc(functionName, {
        p_listing_id: listingId,
      });

      if (error) throw error;

      setListings((current) =>
        current.filter((listing) => listing.id !== listingId)
      );

      setMessage(
        action === "approve"
          ? "Listing approved successfully."
          : "Listing rejected successfully."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update listing status."
      );
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#080b12] px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <a href="/" className="font-bold text-amber-400">
          ◈ CineRelay
        </a>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-amber-400">
              Administration
            </p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Listing Review
            </h1>
            <p className="mt-2 text-gray-400">
              Review listing details and privately uploaded ticket evidence.
            </p>
          </div>

          <button
            onClick={() => void loadListings()}
            disabled={loading}
            className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold hover:border-amber-400 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <p className="mt-10 text-gray-400">
            Loading pending listings and ticket images...
          </p>
        ) : !isAdmin ? (
          <section className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <h2 className="font-bold text-red-300">
              Admin access unavailable
            </h2>
            <p className="mt-2 break-words text-sm text-gray-300">
              {message || "Your account is not authorized."}
            </p>
            <p className="mt-3 text-sm text-gray-400">
              Confirm that you are signed in with the administrator
              account registered in Supabase admin_users.
            </p>
          </section>
        ) : (
          <>
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm text-gray-400">
                Pending submissions
              </p>
              <p className="mt-2 text-3xl font-black text-amber-400">
                {listings.length}
              </p>
            </div>

            {message && (
              <p role="status" className="mt-5 text-sm text-amber-300">
                {message}
              </p>
            )}

            {listings.length === 0 ? (
              <section className="mt-8 rounded-2xl border border-white/10 p-8 text-center">
                <h2 className="text-xl font-bold">
                  No pending listings
                </h2>
                <p className="mt-2 text-gray-400">
                  New submissions will appear here.
                </p>
              </section>
            ) : (
              <div className="mt-8 space-y-6">
                {listings.map((listing) => (
                  <article
                    key={listing.id}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 p-5 sm:p-7">
                      <div>
                        <span className="text-sm text-amber-400">
                          {listing.category}
                        </span>
                        <h2 className="mt-2 break-words text-xl font-bold">
                          {listing.title}
                        </h2>
                      </div>

                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-sm text-amber-300">
                        Pending
                      </span>
                    </div>

                    <div className="border-y border-white/10 bg-black/20 p-5 sm:p-7">
                      <h3 className="font-bold">
                        Private ticket evidence
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-gray-400">
                        Visible to authorized admins only. The preview link
                        expires after five minutes.
                      </p>

                      {listing.evidence_url ? (
                        <div className="mt-4">
                          <a
                            href={listing.evidence_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block max-w-full"
                          >
                            <img
                              src={listing.evidence_url}
                              alt={`Private ticket evidence for ${listing.title}`}
                              className="max-h-[500px] max-w-full rounded-xl border border-white/10 object-contain"
                            />
                          </a>
                          <p className="mt-2 text-xs text-gray-500">
                            Select the image to open it in a separate tab.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                          <p className="text-sm text-amber-300">
                            Ticket image unavailable.
                          </p>
                          <p className="mt-1 text-xs leading-5 text-gray-400">
                            Check that the listing has an evidence_path and
                            the Storage policies allow authorized admin access.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="p-5 sm:p-7">
                      <div className="grid gap-4 text-sm sm:grid-cols-2">
                        <div>
                          <p className="text-gray-500">Venue / operator</p>
                          <p className="mt-1">
                            {listing.venue || "Not provided"}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-500">Location</p>
                          <p className="mt-1">
                            {listing.location || "Not provided"}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-500">Asking price</p>
                          <p className="mt-1 text-xl font-bold text-amber-400">
                            ₹{Number(listing.price).toLocaleString("en-IN")}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-500">Submitted</p>
                          <p className="mt-1">
                            {new Date(listing.created_at).toLocaleString(
                              "en-IN"
                            )}
                          </p>
                        </div>

                        <div className="sm:col-span-2">
                          <p className="text-gray-500">Seller ID</p>
                          <p className="mt-1 break-all text-xs text-gray-300">
                            {listing.seller_id}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5">
                        <p className="text-sm text-gray-500">Description</p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-300">
                          {listing.description}
                        </p>
                      </div>

                      <p className="mt-4 break-all text-xs text-gray-500">
                        Listing ID: {listing.id}
                      </p>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <button
                          onClick={() =>
                            void updateStatus(listing.id, "approve")
                          }
                          disabled={workingId !== null}
                          className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-black disabled:opacity-50"
                        >
                          {workingId === listing.id
                            ? "Processing..."
                            : "Approve listing"}
                        </button>

                        <button
                          onClick={() =>
                            void updateStatus(listing.id, "reject")
                          }
                          disabled={workingId !== null}
                          className="rounded-xl border border-red-500/40 px-5 py-3 font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
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
