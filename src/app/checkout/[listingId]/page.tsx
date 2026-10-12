"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isTicketExpired } from "@/lib/expiration";

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
  screen_number?: string | null;
  seat_category?: string | null;
  seat_numbers?: string | null;
  cancellation_reason?: string | null;
  tmdb_movie_id?: number | null;
  status: string;
};

type QRData = {
  orderId: string;
  amountPaise: number;
  expiresAt: string;
  qrImageUrl: string;
  qrShortUrl: string | null;
};

type PaymentMethod = "card" | "upi_qr";
type PaymentStatus = "idle" | "creating" | "pending" | "verifying" | "paid" | "expired" | "failed";

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void | Promise<void>;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
    backdrop_color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatEventDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
}

function formatTime(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return value;
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function BrandLogo({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f4dfac] to-[#bd9345] font-black text-[#111111] ${
        small ? "h-8 w-8 text-sm" : "h-10 w-10 text-lg"
      }`}
    >
      C
    </span>
  );
}

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: "location" | "calendar" | "clock" | "ticket" | "shield" | "check" | "arrow" | "card" | "qr" | "lock";
  className?: string;
}) {
  const props = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "location":
      return (
        <svg {...props}>
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      );
    case "clock":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...props}>
          <path d="M4 5h16v4a3 3 0 0 0 0 6v4H4v-4a3 3 0 0 0 0-6V5Z" />
          <path d="M12 7v2M12 12v2M12 17v.01" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...props}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    case "card":
      return (
        <svg {...props}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case "qr":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3h-3zM17 17h4v4h-4zM14 20h3" />
        </svg>
      );
    case "lock":
      return (
        <svg {...props}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
  }
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: "location" | "calendar" | "clock" | "ticket";
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d6b36a]/15 bg-[#d6b36a]/[0.07] text-[#e7ca8d]">
        <Icon name={icon} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-white/40">
          {label}
        </p>
        <p className="mt-1.5 break-words text-sm font-medium leading-6 text-white/85">
          {value}
        </p>
      </div>
    </div>
  );
}

const cardStyle =
  "rounded-[24px] border border-white/[0.09] bg-[#111317]/90 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl";

const secondaryButton =
  "flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.13] bg-white/[0.025] px-5 py-3.5 text-sm font-semibold text-white/80 transition hover:border-[#d6b36a]/50 hover:bg-[#d6b36a]/[0.06] hover:text-[#f0dcae] disabled:cursor-not-allowed disabled:opacity-50";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error("Failed to load Razorpay Checkout SDK script.");
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export default function CheckoutPage() {
  const params = useParams<{ listingId: string }>();
  const router = useRouter();
  const listingId = params?.listingId;

  const [listing, setListing] = useState<Listing | null>(null);
  const [moviePoster, setMoviePoster] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listingError, setListingError] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [paymentError, setPaymentError] = useState("");
  const [remainingTime, setRemainingTime] = useState("");

  const [confirmedOrderId, setConfirmedOrderId] = useState<string>("");
  const [confirmedPaymentId, setConfirmedPaymentId] = useState<string>("");

  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load listing details
  useEffect(() => {
    let active = true;

    async function loadListing() {
      if (!listingId) {
        setListingError("The listing ID is missing.");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("listings")
          .select(
            "id, seller_id, title, category, venue, location, price, description, event_date, event_time, screen_number, seat_category, seat_numbers, cancellation_reason, tmdb_movie_id, status"
          )
          .eq("id", listingId)
          .eq("status", "approved")
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.error("Checkout listing error:", error);
          setListingError("We couldn't load this ticket. Please try again.");
        } else if (!data) {
          setListingError("This listing is unavailable or no longer approved.");
        } else {
          const loadedListing = data as Listing;
          if (isTicketExpired(loadedListing.event_date, loadedListing.event_time)) {
            setListingError("This ticket has expired as the event show date/time has passed.");
            setLoading(false);
            return;
          }
          setListing(loadedListing);

          // If it's a movie with TMDB ID, fetch poster
          if (loadedListing.category === "Movies" && loadedListing.tmdb_movie_id) {
            void fetch(`/api/movies/${loadedListing.tmdb_movie_id}`)
              .then((res) => (res.ok ? res.json() : null))
              .then((movieData) => {
                if (active && movieData?.posterUrl) {
                  setMoviePoster(movieData.posterUrl);
                }
              })
              .catch((err) => console.warn("Could not load movie poster:", err));
          }
        }
      } catch (error) {
        console.error("Load listing error:", error);
        if (active) {
          setListingError("We couldn't load this ticket. Please try again.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadListing();

    return () => {
      active = false;
    };
  }, [listingId]);

  // Clean up polling interval
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // UPI QR Countdown
  useEffect(() => {
    if (!qrData || paymentStatus !== "pending") return;

    const updateCountdown = () => {
      const difference = new Date(qrData.expiresAt).getTime() - Date.now();

      if (difference <= 0) {
        setRemainingTime("00:00");
        setPaymentStatus("expired");
        if (pollingRef.current) clearInterval(pollingRef.current);
        return;
      }

      const minutes = Math.floor(difference / 60000);
      const seconds = Math.floor((difference % 60000) / 1000);

      setRemainingTime(
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, [qrData, paymentStatus]);

  // Status Polling for QR flow
  const startStatusPolling = useCallback(
    (orderId: string, token: string) => {
      if (pollingRef.current) clearInterval(pollingRef.current);

      pollingRef.current = setInterval(async () => {
        try {
          const response = await fetch(
            `/api/checkout/status?orderId=${encodeURIComponent(orderId)}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (!response.ok) return;

          const data = await response.json();

          if (data.status === "paid") {
            setPaymentStatus("paid");
            setConfirmedOrderId(orderId);
            if (pollingRef.current) clearInterval(pollingRef.current);
          } else if (data.status === "expired") {
            setPaymentStatus("expired");
            if (pollingRef.current) clearInterval(pollingRef.current);
          } else if (data.status === "failed") {
            setPaymentStatus("failed");
            setPaymentError("The payment failed. Please try again.");
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        } catch (error) {
          console.warn("Payment status polling failed:", error);
        }
      }, 3000);
    },
    []
  );

  // 1. UPI QR Checkout Handler
  async function handleCreateQR() {
    if (!listing || paymentStatus === "creating") return;

    setPaymentStatus("creating");
    setPaymentError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        router.push(
          `/auth?mode=login&next=${encodeURIComponent(`/checkout/${listing.id}`)}`
        );
        return;
      }

      if (session.user.id === listing.seller_id) {
        setPaymentStatus("failed");
        setPaymentError("You cannot purchase your own listing.");
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
        if (data.code === "QR_NOT_SUPPORTED") {
          setPaymentStatus("failed");
          setPaymentError(
            data.error ||
              "UPI QR code generation is currently unavailable. Please switch to 'Pay with Card / Razorpay'."
          );
          return;
        }
        throw new Error(data.error || "Unable to generate payment QR.");
      }

      if (
        !data.orderId ||
        !data.expiresAt ||
        !data.qrImageUrl ||
        typeof data.amountPaise !== "number"
      ) {
        throw new Error("The payment provider returned incomplete QR details.");
      }

      const newQR: QRData = {
        orderId: data.orderId,
        amountPaise: data.amountPaise,
        expiresAt: data.expiresAt,
        qrImageUrl: data.qrImageUrl,
        qrShortUrl: data.qrShortUrl ?? null,
      };

      setQrData(newQR);
      setConfirmedOrderId(newQR.orderId);
      setPaymentStatus("pending");
      startStatusPolling(newQR.orderId, session.access_token);
    } catch (error) {
      console.error("QR generation error:", error);
      setPaymentStatus("failed");
      setPaymentError(
        error instanceof Error ? error.message : "Unable to initialize QR checkout."
      );
    }
  }

  // 2. Card / Razorpay Standard Checkout Handler
  async function handleCardCheckout() {
    if (!listing || paymentStatus === "creating") return;

    setPaymentStatus("creating");
    setPaymentError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        router.push(
          `/auth?mode=login&next=${encodeURIComponent(`/checkout/${listing.id}`)}`
        );
        return;
      }

      if (session.user.id === listing.seller_id) {
        setPaymentStatus("failed");
        setPaymentError("You cannot purchase your own listing.");
        return;
      }

      // Load Razorpay Checkout SDK
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error(
          "Could not load the secure payment gateway. Please check your network and try again."
        );
      }

      // Create server order
      const response = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ listingId: listing.id }),
      });

      const orderData = await response.json();

      if (!response.ok) {
        throw new Error(orderData.error || "Failed to create payment order.");
      }

      if (!orderData.orderId || !orderData.razorpayOrderId || !orderData.keyId) {
        throw new Error("Incomplete payment details received from server.");
      }

      // Initialize Razorpay Standard Checkout Modal
      const options: RazorpayOptions = {
        key: orderData.keyId,
        amount: orderData.amountPaise,
        currency: orderData.currency || "INR",
        name: "CineRelay",
        description: listing.title,
        order_id: orderData.razorpayOrderId,
        prefill: {
          name: orderData.buyerName || undefined,
          email: orderData.buyerEmail || undefined,
          contact: orderData.buyerPhone || undefined,
        },
        theme: {
          color: "#d6b36a",
          backdrop_color: "#090a0c",
        },
        handler: async (paymentResponse: RazorpayResponse) => {
          setPaymentStatus("verifying");

          try {
            // Verify payment signature server-side
            const verifyRes = await fetch("/api/checkout/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                orderId: orderData.orderId,
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyRes.ok && verifyData.success) {
              setPaymentStatus("paid");
              setConfirmedOrderId(orderData.orderId);
              setConfirmedPaymentId(paymentResponse.razorpay_payment_id);
            } else {
              setPaymentStatus("failed");
              setPaymentError(
                verifyData.error || "Payment signature verification failed."
              );
            }
          } catch (verifyErr) {
            console.error("Verification callback failed:", verifyErr);
            setPaymentStatus("failed");
            setPaymentError(
              "Your payment was received but could not be verified immediately. Please check your orders."
            );
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentStatus("idle");
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);

      razorpayInstance.on("payment.failed", (failedRes: unknown) => {
        console.error("Razorpay payment failed:", failedRes);
        const errObj = failedRes as { error?: { description?: string } };
        setPaymentStatus("failed");
        setPaymentError(
          errObj?.error?.description || "Payment was declined or cancelled."
        );
      });

      razorpayInstance.open();
    } catch (error) {
      console.error("Card checkout error:", error);
      setPaymentStatus("failed");
      setPaymentError(
        error instanceof Error ? error.message : "Unable to launch checkout."
      );
    }
  }

  // Seller Chat Handler
  async function handleChat() {
    if (!listing || chatLoading) return;

    setChatLoading(true);
    setChatError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push(
          `/auth?mode=login&next=${encodeURIComponent(`/checkout/${listing.id}`)}`
        );
        return;
      }

      if (user.id === listing.seller_id) {
        setChatError("You cannot start a chat with yourself.");
        return;
      }

      const { data, error } = await supabase.rpc("open_listing_chat", {
        p_listing_id: listing.id,
      });

      if (error) throw error;

      if (!data) {
        throw new Error("The chat could not be opened.");
      }

      router.push(`/messages/${data}`);
    } catch (error) {
      console.error("Open chat error:", error);
      setChatError(
        error instanceof Error
          ? error.message
          : "Could not open the seller chat. Please try again."
      );
    } finally {
      setChatLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#090a0c] px-5 text-white">
        <div className="text-center">
          <BrandLogo />
          <p className="mt-5 animate-pulse text-sm text-white/55">
            Preparing your secure checkout...
          </p>
        </div>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090a0c] px-5 py-12 text-white">
        <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-[#d6b36a]/10 blur-[110px]" />

        <section className={`${cardStyle} relative w-full max-w-lg p-8 text-center sm:p-10`}>
          <div className="mx-auto flex justify-center">
            <BrandLogo />
          </div>
          <h1 className="mt-7 text-2xl font-semibold tracking-tight">
            Ticket unavailable
          </h1>
          <p className="mt-3 text-sm leading-7 text-white/60">
            {listingError || "We couldn't find this ticket."}
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d6b36a] to-[#ebce8e] px-6 py-3.5 text-sm font-bold text-[#111111] transition hover:brightness-110"
          >
            Return to marketplace <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090a0c] text-[#f5f2eb]">
      {/* Background Ambience */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-[35%] top-[-300px] h-[650px] w-[850px] rounded-full bg-[#d6b36a]/[0.085] blur-[150px]" />
        <div className="absolute bottom-[-200px] right-[-150px] h-[400px] w-[400px] rounded-full bg-amber-900/[0.05] blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.013)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.013)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/[0.08] bg-[#090a0c]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <BrandLogo />
            <span className="text-xl font-bold tracking-[-0.06em]">
              Cine<span className="text-[#d6b36a]">Relay</span>
            </span>
          </Link>

          <Link
            href="/messages"
            className="rounded-full border border-white/[0.10] px-4 py-2.5 text-xs font-medium text-white/70 transition hover:border-[#d6b36a]/40 hover:text-[#f0dcae] sm:text-sm"
          >
            Messages <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href={`/listing/${listing.id}`}
          className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-[#f0dcae]"
        >
          <span>←</span> Back to listing details
        </Link>

        {/* Hero title */}
        <div className="mb-8 mt-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d6b36a]/25 bg-[#d6b36a]/[0.06] px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d6b36a]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#e7ca8d]">
              Protected checkout
            </span>
          </div>

          <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.055em] text-[#fffaf0] sm:text-4xl lg:text-5xl">
            Complete your ticket
            <br className="hidden sm:block" /> purchase{" "}
            <span className="italic text-[#d6b36a]">securely.</span>
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
            Verified pricing directly from the server. Pay instantly via Credit/Debit Cards, UPI, or Netbanking.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8">
          {/* Left column: Ticket & show details */}
          <section className={`${cardStyle} min-w-0 p-5 sm:p-8 lg:p-9`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#d6b36a]/30 bg-[#d6b36a]/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#e7ca8d]">
                <Icon name="ticket" className="h-3.5 w-3.5" />
                {listing.category}
              </span>

              <span className="inline-flex items-center gap-2 text-xs text-white/40">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Verified & Available
              </span>
            </div>

            {/* Movie Poster & Title preview */}
            <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
              {moviePoster && (
                <div className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-2xl border border-white/10 shadow-lg sm:w-32">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={moviePoster}
                    alt={`${listing.title} poster`}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-2xl font-semibold leading-tight tracking-[-0.045em] text-[#fffaf0] sm:text-3xl">
                  {listing.title}
                </h2>
                <p className="mt-2 text-sm text-white/50">
                  {listing.category === "Movies" ? "Movie Ticket" : "Event Entry"}
                </p>
              </div>
            </div>

            {/* Details Grid */}
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {listing.venue && (
                <DetailRow icon="location" label="Venue / Cinema" value={listing.venue} />
              )}

              {listing.location && (
                <DetailRow icon="location" label="City / Location" value={listing.location} />
              )}

              {listing.event_date && (
                <DetailRow
                  icon="calendar"
                  label="Show Date"
                  value={formatEventDate(listing.event_date)}
                />
              )}

              {listing.event_time && (
                <DetailRow
                  icon="clock"
                  label="Show Time"
                  value={formatTime(listing.event_time) || listing.event_time}
                />
              )}

              {listing.screen_number && (
                <DetailRow
                  icon="ticket"
                  label="Screen"
                  value={listing.screen_number}
                />
              )}

              {listing.seat_numbers && (
                <DetailRow
                  icon="ticket"
                  label="Seat Numbers"
                  value={
                    listing.seat_category
                      ? `${listing.seat_numbers} (${listing.seat_category})`
                      : listing.seat_numbers
                  }
                />
              )}
            </div>

            {listing.description && (
              <div className="mt-6 rounded-2xl border border-white/[0.08] bg-black/15 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                  Seller Note & Transfer Info
                </p>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-white/70">
                  {listing.description}
                </p>
              </div>
            )}

            {/* Buyer Safety Reminders */}
            <div className="mt-8 border-t border-white/[0.09] pt-7">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#d6b36a]/20 bg-[#d6b36a]/[0.07] text-[#e7ca8d]">
                  <Icon name="shield" className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-[#fffaf0]">Buyer Protection & Safety</h3>
                  <p className="mt-1 text-xs text-white/45">
                    100% encrypted provider checkout
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  "Prices are locked and verified server-side.",
                  "All card and online transactions are processed through Razorpay's PCI-DSS compliant infrastructure.",
                  "Never share your OTP, password, or UPI PIN with anyone, including sellers.",
                ].map((item) => (
                  <p
                    key={item}
                    className="flex items-start gap-3 text-sm leading-6 text-white/65"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#d6b36a]/25 text-[#e7ca8d]">
                      <Icon name="check" className="h-3 w-3" />
                    </span>
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </section>

          {/* Right column: Payment Methods & Order Summary */}
          <aside className={`${cardStyle} min-w-0 p-5 sm:p-8 lg:sticky lg:top-6`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                Order Summary
              </p>
              <span className="rounded-full border border-white/[0.09] px-2.5 py-1 text-[10px] text-white/45">
                INR (₹)
              </span>
            </div>

            <div className="mt-5">
              <p className="text-xs text-white/55">Total Payable Amount</p>
              <p className="mt-2 break-words text-4xl font-semibold tracking-[-0.055em] text-[#e4c783] sm:text-5xl">
                {formatPrice(Number(listing.price))}
              </p>
            </div>

            <div className="mt-6 border-y border-white/[0.08] py-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-white/50">Ticket Price</span>
                <span className="font-medium text-white/85">
                  {formatPrice(Number(listing.price))}
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-4 text-sm">
                <span className="text-white/50">Platform / Convenience Fee</span>
                <span className="font-medium text-emerald-400">
                  ₹0.00 (Free)
                </span>
              </div>
            </div>

            {/* Payment Method Selector (when not confirmed) */}
            {paymentStatus !== "paid" && (
              <div className="mt-6">
                <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-white/60">
                  Select Payment Method
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod("card");
                      setPaymentError("");
                      setPaymentStatus("idle");
                    }}
                    className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3.5 text-center transition ${
                      paymentMethod === "card"
                        ? "border-[#d6b36a] bg-[#d6b36a]/[0.10] text-[#f4dfac]"
                        : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20"
                    }`}
                  >
                    <span className="mb-0.5 inline-block rounded-full bg-[#d6b36a]/20 border border-[#d6b36a]/40 px-2 py-0.5 text-[9px] font-bold text-[#f4dfac]">
                      RECOMMENDED
                    </span>
                    <Icon name="card" className="h-5 w-5" />
                    <span className="text-xs font-bold">UPI, Cards & Netbanking</span>
                    <span className="text-[10px] text-white/45">GPay, PhonePe, QR, Cards</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod("upi_qr");
                      setPaymentError("");
                      if (paymentStatus !== "pending") {
                        setPaymentStatus("idle");
                      }
                    }}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3.5 text-center transition ${
                      paymentMethod === "upi_qr"
                        ? "border-[#d6b36a] bg-[#d6b36a]/[0.10] text-[#f4dfac]"
                        : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20"
                    }`}
                  >
                    <span className="mb-0.5 inline-block rounded-full bg-white/[0.04] border border-white/10 px-2 py-0.5 text-[9px] font-medium text-white/40">
                      DIRECT QR
                    </span>
                    <Icon name="qr" className="h-5 w-5" />
                    <span className="text-xs font-bold">Standalone UPI QR</span>
                    <span className="text-[10px] text-white/45">Requires Bharat QR</span>
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons: Card flow */}
            {paymentMethod === "card" && (paymentStatus === "idle" || paymentStatus === "failed" || paymentStatus === "creating") && (
              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => void handleCardCheckout()}
                  disabled={paymentStatus === "creating"}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d6b36a] to-[#ebce8e] px-5 py-4 text-sm font-bold text-[#111111] shadow-lg shadow-[#d6b36a]/[0.08] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {paymentStatus === "creating" ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                      Opening secure gateway...
                    </>
                  ) : (
                    <>
                      <Icon name="lock" className="h-4 w-4" />
                      Pay {formatPrice(Number(listing.price))} via UPI / Cards
                      <Icon name="arrow" className="h-4 w-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => void handleChat()}
                  disabled={chatLoading}
                  className={secondaryButton}
                >
                  {chatLoading ? "Opening chat..." : "Chat with seller first"}
                </button>
              </div>
            )}

            {/* Verifying Card Signature State */}
            {paymentStatus === "verifying" && (
              <div className="mt-6 rounded-2xl border border-[#d6b36a]/30 bg-[#d6b36a]/[0.06] p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#d6b36a]/30 bg-[#d6b36a]/[0.10]">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#d6b36a] border-t-transparent" />
                </div>
                <h4 className="mt-4 font-bold text-[#f4dfac]">Verifying Payment Signature</h4>
                <p className="mt-2 text-xs leading-5 text-white/60">
                  Please wait while the server verifies your Razorpay transaction signature. Do not close this window.
                </p>
              </div>
            )}

            {/* Action Buttons: UPI QR flow */}
            {paymentMethod === "upi_qr" && (paymentStatus === "idle" || paymentStatus === "failed" || paymentStatus === "creating") && (
              <div className="mt-6 space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-center text-xs leading-5 text-white/60">
                  💡 Tip: The <strong className="text-[#f4dfac]">UPI & Cards</strong> option includes Google Pay, PhonePe, Paytm, and an in-modal QR code.
                </div>

                <button
                  type="button"
                  onClick={() => void handleCreateQR()}
                  disabled={paymentStatus === "creating"}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d6b36a] to-[#ebce8e] px-5 py-4 text-sm font-bold text-[#111111] shadow-lg shadow-[#d6b36a]/[0.08] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {paymentStatus === "creating" ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                      Generating single-use QR...
                    </>
                  ) : (
                    <>
                      <Icon name="qr" className="h-4 w-4" />
                      Generate UPI QR for {formatPrice(Number(listing.price))}
                      <Icon name="arrow" className="h-4 w-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => void handleChat()}
                  disabled={chatLoading}
                  className={secondaryButton}
                >
                  {chatLoading ? "Opening chat..." : "Chat with seller first"}
                </button>
              </div>
            )}

            {/* Pending QR payment */}
            {paymentStatus === "pending" && qrData && (
              <div className="mt-6">
                <div className="rounded-2xl border border-[#d6b36a]/25 bg-white p-4 shadow-[0_18px_55px_rgba(0,0,0,0.25)]">
                  <div className="mx-auto flex max-w-[240px] items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrData.qrImageUrl}
                      alt="UPI payment QR code"
                      className="h-auto w-full object-contain"
                    />
                  </div>
                  <p className="mt-3 text-center text-xs font-semibold text-slate-800">
                    Scan with PhonePe, Google Pay, Paytm, or CRED
                  </p>
                  <p className="mt-1 text-center text-sm font-bold text-slate-900">
                    Exact Amount: {formatPrice(qrData.amountPaise / 100)}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/[0.09] bg-black/20 px-4 py-3">
                  <span className="text-xs text-white/55">QR expires in</span>
                  <span className="font-mono text-sm font-semibold text-[#e7ca8d]">
                    {remainingTime || "Calculating..."}
                  </span>
                </div>

                {qrData.qrShortUrl && (
                  <a
                    href={qrData.qrShortUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`mt-3 ${secondaryButton}`}
                  >
                    Open UPI link directly ↗
                  </a>
                )}

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-emerald-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                  Listening for verified server confirmation...
                </div>
              </div>
            )}

            {/* Expired payment state */}
            {paymentStatus === "expired" && (
              <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-5">
                <p className="font-semibold text-[#e7ca8d]">Payment Session Expired</p>
                <p className="mt-2 text-xs leading-6 text-white/55">
                  The payment window for this checkout has closed. You can generate a fresh session below.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentStatus("idle");
                    if (paymentMethod === "card") {
                      void handleCardCheckout();
                    } else {
                      void handleCreateQR();
                    }
                  }}
                  className="mt-4 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#d6b36a] to-[#ebce8e] px-4 py-3.5 text-sm font-bold text-[#111111] transition hover:brightness-110"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Confirmed / Paid State */}
            {paymentStatus === "paid" && (
              <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-5">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300">
                  <Icon name="check" className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-center text-lg font-semibold text-emerald-300">
                  Payment Verified & Confirmed!
                </h3>
                <p className="mt-2 break-words text-center text-xs leading-6 text-white/70">
                  Your ticket has been marked sold to you. The seller has been notified.
                </p>

                <div className="mt-4 space-y-1.5 rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
                  <div className="flex justify-between text-white/60">
                    <span>Order Ref:</span>
                    <span className="font-mono text-white/80">{confirmedOrderId || qrData?.orderId}</span>
                  </div>
                  {confirmedPaymentId && (
                    <div className="flex justify-between text-white/60">
                      <span>Payment ID:</span>
                      <span className="font-mono text-white/80">{confirmedPaymentId}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-white/60">
                    <span>Amount Paid:</span>
                    <span className="font-bold text-amber-300">{formatPrice(Number(listing.price))}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleChat()}
                  disabled={chatLoading}
                  className="mt-5 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#d6b36a] to-[#ebce8e] px-4 py-3.5 text-sm font-bold text-[#111111] transition hover:brightness-110 disabled:opacity-50"
                >
                  {chatLoading ? "Opening chat..." : "Coordinate Ticket Transfer with Seller"}
                </button>
                <Link href="/profile" className={`mt-3 ${secondaryButton}`}>
                  View in My Orders (Profile)
                </Link>
              </div>
            )}

            {/* Payment error message */}
            {paymentError && (
              <div
                role="alert"
                className="mt-4 break-words rounded-xl border border-red-400/25 bg-red-400/[0.08] p-3 text-xs leading-6 text-red-200"
              >
                <p className="font-bold">Checkout Notice:</p>
                <p>{paymentError}</p>
                {paymentMethod === "upi_qr" && (paymentError.includes("QR") || paymentError.includes("provider") || paymentError.includes("enabled")) && (
                  <div className="mt-3 border-t border-red-400/20 pt-2.5">
                    <p className="text-xs text-white/80">
                      You can complete your payment via UPI (Google Pay, PhonePe, Paytm, or in-modal QR) right now:
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod("card");
                        setPaymentError("");
                        setPaymentStatus("idle");
                        void handleCardCheckout();
                      }}
                      className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d6b36a] to-[#ebce8e] px-4 py-3 text-xs font-bold text-[#111111] shadow transition hover:brightness-110"
                    >
                      Pay via UPI / Cards (Razorpay Checkout) →
                    </button>
                  </div>
                )}
              </div>
            )}

            {chatError && (
              <p
                role="alert"
                className="mt-4 break-words rounded-xl border border-red-400/20 bg-red-400/[0.07] p-3 text-xs leading-6 text-red-200"
              >
                {chatError}
              </p>
            )}

            {/* Provider badge */}
            <div className="mt-7 border-t border-white/[0.09] pt-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#d6b36a]/20 bg-[#d6b36a]/[0.06] text-[#e7ca8d]">
                  <Icon name="shield" className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white/80">
                    Trusted Payment Security
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-white/40">
                    Powered by Razorpay & CineRelay server verification.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {[
                  "Server-side price verification",
                  "HMAC-SHA256 signature verification",
                  "Direct seller-to-buyer transfer coordination",
                ].map((item) => (
                  <p
                    key={item}
                    className="flex items-start gap-2.5 text-xs leading-5 text-white/50"
                  >
                    <span className="text-[#d6b36a]">✓</span>
                    {item}
                  </p>
                ))}
              </div>
            </div>

            <p className="mt-5 text-[10px] leading-5 text-white/35">
              All transactions are processed in INR. Confirm ticket transfer eligibility and conditions before completing payment.
            </p>
          </aside>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 mt-10 border-t border-white/[0.08] bg-black/20">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-7 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandLogo small />
            <span className="font-semibold text-white/75">
              Cine<span className="text-[#d6b36a]">Relay</span>
            </span>
          </Link>

          <span>Discover. Connect. Relay.</span>

          <div className="flex flex-wrap gap-4">
            <Link href="/" className="transition hover:text-[#e7ca8d]">
              Marketplace
            </Link>
            <Link href="/profile" className="transition hover:text-[#e7ca8d]">
              Profile
            </Link>
            <Link href="/messages" className="transition hover:text-[#e7ca8d]">
              Messages
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
