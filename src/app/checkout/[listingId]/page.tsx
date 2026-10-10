"use client";

import { useEffect, useRef, useState } from "react";
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

type QRData = {
  orderId: string;
  amountPaise: number;
  expiresAt: string;
  qrImageUrl: string;
  qrShortUrl: string | null;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(price);
}

export default function CheckoutPage() {
  const params = useParams<{ listingId: string }>();
  const router = useRouter();
  const listingId = params?.listingId;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [qrData, setQrData] = useState<QRData | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "pending" | "paid" | "expired" | "failed"
  >("idle");
  const [paymentError, setPaymentError] = useState("");
  const [remainingTime, setRemainingTime] = useState("");

  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchListing() {
      if (!listingId) return;

      const { data, error: listingError } = await supabase
        .from("listings")
        .select(
          "id, seller_id, title, category, venue, location, price, description, event_date, event_time, status, created_at"
        )
        .eq("id", listingId)
        .eq("status", "approved")
        .maybeSingle();

      if (!active) return;

      if (listingError) {
        console.error("Listing load error:", listingError);
        setError("Unable to load this ticket. Please try again.");
        setListing(null);
      } else if (!data) {
        setError("This ticket is unavailable or has been removed.");
        setListing(null);
      } else {
        setError("");
        setListing(data as Listing);
      }

      setLoading(false);
    }

    void fetchListing();

    return () => {
      active = false;
    };
  }, [listingId]);

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Countdown timer for active QR code
  useEffect(() => {
    if (!qrData || paymentStatus !== "pending") return;

    const interval = setInterval(() => {
      const diff = new Date(qrData.expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemainingTime("00:00");
        setPaymentStatus("expired");
        clearInterval(interval);
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setRemainingTime(
          `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [qrData, paymentStatus]);

  async function handleCreateQR() {
    if (!listing) return;

    setQrLoading(true);
    setPaymentError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        router.push(
          `/auth?mode=login&next=${encodeURIComponent(
            `/checkout/${listing.id}`
          )}`
        );
        return;
      }

      if (session.user.id === listing.seller_id) {
        setPaymentError("You cannot buy your own ticket listing.");
        return;
      }

      const response = await fetch("/api/checkout/create-qr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ listingId: listing.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create UPI QR code.");
      }

      setQrData({
        orderId: data.orderId,
        amountPaise: data.amountPaise,
        expiresAt: data.expiresAt,
        qrImageUrl: data.qrImageUrl,
        qrShortUrl: data.qrShortUrl,
      });

      setPaymentStatus("pending");

      // Start status polling
      startStatusPolling(data.orderId, session.access_token);
    } catch (err) {
      console.error("Create QR error:", err);
      setPaymentError(
        err instanceof Error ? err.message : "Checkout initialization failed."
      );
      setPaymentStatus("failed");
    } finally {
      setQrLoading(false);
    }
  }

  function startStatusPolling(orderId: string, token: string) {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/checkout/status?orderId=${orderId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) return;

        const data = await res.json();

        if (data.status === "paid") {
          setPaymentStatus("paid");
          if (pollingRef.current) clearInterval(pollingRef.current);
        } else if (data.status === "expired") {
          setPaymentStatus("expired");
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch (err) {
        console.warn("Status poll error:", err);
      }
    }, 3000);
  }

  async function handleChat() {
    if (!listing) return;
    setChatLoading(true);
    setChatError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push(
          `/auth?mode=login&next=${encodeURIComponent(
            `/checkout/${listing.id}`
          )}`
        );
        return;
      }

      if (user.id === listing.seller_id) {
        setChatError("You cannot start a chat with yourself.");
        return;
      }

      const { data: conversationId, error: rpcError } =
        await supabase.rpc("open_listing_chat", {
          p_listing_id: listing.id,
        });

      if (rpcError) {
        console.error("Open chat error:", rpcError);
        setChatError(
          "Could not open this chat. Please check that the listing is available."
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
          Loading checkout details...
        </p>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="min-h-screen bg-[#080d19] px-5 py-16 text-white">
        <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#0d1423] p-8 text-center">
          <div className="text-5xl">🎟️</div>
          <h1 className="mt-4 text-2xl font-bold">Ticket unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-gray-400">
            {error || "We couldn&apos;t find this listing."}
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
          href={`/listing/${listing.id}`}
          className="text-sm text-gray-400 transition hover:text-amber-400"
        >
          ← Back to Listing
        </Link>

        <div className="mt-7 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Left Column: Ticket Details */}
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
                      {listing.event_time ? ` · ${listing.event_time}` : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 border-t border-white/10 pt-7">
              <h2 className="text-lg font-bold">Escrow Protection Guarantee</h2>
              <p className="mt-3 text-sm leading-7 text-gray-300">
                Your payment is held securely in the CineRelay escrow vault.
                Funds are only released to the seller after the ticket is
                verified and entry is confirmed.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-6 text-amber-200/90">
              💡 <strong>Buyer Advisory:</strong> Never pay sellers directly
              outside the platform. Coordinate ticket barcode receipt in chat
              before heading to the cinema.
            </div>
          </section>

          {/* Right Column: Checkout & Razorpay QR Payment Flow */}
          <aside className="h-fit rounded-3xl border border-white/10 bg-[#0d1423] p-6 sm:p-8">
            <p className="text-sm text-gray-400">Total payable</p>
            <p className="mt-2 text-4xl font-black text-amber-400">
              {formatPrice(Number(listing.price))}
            </p>

            {/* State 1: Payment Success */}
            {paymentStatus === "paid" && (
              <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-3xl">
                  ✓
                </div>
                <h2 className="mt-4 text-xl font-bold text-emerald-400">
                  Payment Confirmed!
                </h2>
                <p className="mt-2 text-sm text-gray-300">
                  Your funds are secured in the CineRelay Escrow Vault. Order ID:{" "}
                  <code className="text-xs text-amber-300">
                    {qrData?.orderId.slice(0, 8)}...
                  </code>
                </p>
                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => void handleChat()}
                    disabled={chatLoading}
                    className="block w-full rounded-xl bg-amber-400 px-5 py-3.5 text-center font-bold text-black transition hover:bg-amber-300 disabled:opacity-50"
                  >
                    {chatLoading
                      ? "Opening Chat..."
                      : "Coordinate Ticket with Seller"}
                  </button>
                  <Link
                    href="/messages"
                    className="block w-full rounded-xl border border-white/15 px-5 py-3 text-center text-sm font-semibold transition hover:border-amber-400 hover:text-amber-400"
                  >
                    View All Messages
                  </Link>
                </div>
              </div>
            )}

            {/* State 2: Active UPI QR Code displayed */}
            {paymentStatus === "pending" && qrData && (
              <div className="mt-6 text-center">
                <div className="rounded-2xl border border-amber-400/30 bg-white p-4 shadow-xl">
                  {/* QR Image */}
                  <div className="mx-auto flex max-w-[220px] items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrData.qrImageUrl}
                      alt="Razorpay UPI QR Code"
                      className="h-auto w-full object-contain"
                    />
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-800">
                    Scan using any UPI App (GPay, PhonePe, Paytm)
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs">
                  <span className="text-gray-400">QR Code expires in:</span>
                  <span className="font-mono font-bold text-amber-400">
                    {remainingTime || "Calculating..."}
                  </span>
                </div>

                {qrData.qrShortUrl && (
                  <a
                    href={qrData.qrShortUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 block w-full rounded-xl border border-white/20 bg-white/5 py-2.5 text-xs font-semibold text-gray-300 transition hover:bg-white/10"
                  >
                    Open UPI Payment Link ↗
                  </a>
                )}

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-emerald-400">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  <span>Awaiting payment confirmation...</span>
                </div>
              </div>
            )}

            {/* State 3: QR Code Expired */}
            {paymentStatus === "expired" && (
              <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center">
                <p className="text-sm font-bold text-red-400">
                  Payment QR Code Expired
                </p>
                <p className="mt-2 text-xs text-gray-300">
                  The 30-minute payment window closed. You can generate a fresh QR
                  code to complete checkout.
                </p>
                <button
                  type="button"
                  onClick={() => void handleCreateQR()}
                  disabled={qrLoading}
                  className="mt-4 w-full rounded-xl bg-amber-400 px-4 py-3 font-bold text-black transition hover:bg-amber-300 disabled:opacity-50"
                >
                  {qrLoading ? "Generating..." : "Generate New QR Code"}
                </button>
              </div>
            )}

            {/* State 4: Initial Buy Button */}
            {(paymentStatus === "idle" || paymentStatus === "failed") && (
              <div className="mt-7 space-y-3">
                <button
                  type="button"
                  onClick={() => void handleCreateQR()}
                  disabled={qrLoading}
                  className="block w-full rounded-xl bg-amber-400 px-5 py-3.5 text-center font-bold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {qrLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                      Generating UPI QR...
                    </span>
                  ) : (
                    `Pay ${formatPrice(Number(listing.price))} with UPI QR`
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => void handleChat()}
                  disabled={chatLoading}
                  className="block w-full rounded-xl border border-white/15 px-5 py-3.5 text-center font-bold transition hover:border-amber-400 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {chatLoading ? "Opening chat..." : "Chat with Seller First"}
                </button>
              </div>
            )}

            {paymentError && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200"
              >
                {paymentError}
              </p>
            )}

            {chatError && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200"
              >
                {chatError}
              </p>
            )}

            <div className="mt-6 space-y-3 border-t border-white/10 pt-5 text-xs text-gray-400">
              <p className="flex items-center gap-2">
                <span className="text-amber-400">✓</span>
                Razorpay Test Mode UPI QR integration
              </p>
              <p className="flex items-center gap-2">
                <span className="text-amber-400">✓</span>
                Real-time webhook and status verification
              </p>
              <p className="flex items-center gap-2">
                <span className="text-amber-400">✓</span>
                100% money-back escrow protection
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
