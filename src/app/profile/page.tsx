
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Tab = "overview" | "bookings" | "support";

type Profile = {
  id: string;
  email: string;
  name: string;
  gender: string;
  age: string;
  phone: string;
  createdAt: string;
};

type ListingSummary = {
  title: string | null;
  category: string | null;
  venue: string | null;
  location: string | null;
  event_date: string | null;
  event_time: string | null;
};

type Order = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount_paise: number;
  currency: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  listing: ListingSummary | ListingSummary[] | null;
};

function CineRelayLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="CineRelay logo"
      role="img"
    >
      <defs>
        <linearGradient id="cineRelayGoldProfile" x1="5" y1="4" x2="43" y2="44">
          <stop offset="0%" stopColor="#f7e2a5" />
          <stop offset="48%" stopColor="#d6b36a" />
          <stop offset="100%" stopColor="#a77a32" />
        </linearGradient>
      </defs>
      <path
        d="M10 8H38C40.2 8 42 9.8 42 12V17C38.5 17 38.5 23 42 23V36C42 38.2 40.2 40 38 40H10C7.8 40 6 38.2 6 36V29C9.5 29 9.5 23 6 23V12C6 9.8 7.8 8 10 8Z"
        stroke="url(#cineRelayGoldProfile)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M14 12V36"
        stroke="url(#cineRelayGoldProfile)"
        strokeWidth="1.5"
        strokeDasharray="2.5 3"
        opacity="0.8"
      />
      <rect
        x="18"
        y="13"
        width="17"
        height="17"
        rx="3"
        stroke="url(#cineRelayGoldProfile)"
        strokeWidth="2"
      />
      <path
        d="M20.5 17H32.5V22H20.5V17Z"
        stroke="url(#cineRelayGoldProfile)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M21 26H23M30 26H32M21 30V32M32 30V32"
        stroke="url(#cineRelayGoldProfile)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M24 34L29 37L24 40V34Z"
        fill="url(#cineRelayGoldProfile)"
      />
    </svg>
  );
}

function formatPrice(amountPaise: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(Number(amountPaise || 0) / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not specified";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not specified";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case "paid":
    case "completed":
    case "success":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "pending":
      return "border-amber-300/20 bg-amber-300/10 text-amber-200";
    case "failed":
    case "cancelled":
    case "expired":
      return "border-rose-400/20 bg-rose-400/10 text-rose-300";
    default:
      return "border-white/10 bg-white/5 text-white/65";
  }
}

function getListing(order: Order): ListingSummary | null {
  if (Array.isArray(order.listing)) {
    return order.listing[0] ?? null;
  }

  return order.listing;
}

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "◈" },
  { id: "bookings", label: "My bookings", icon: "▣" },
  { id: "support", label: "Support", icon: "✳" },
];

export default function ProfilePage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [bookingFilter, setBookingFilter] = useState("all");

  const [profile, setProfile] = useState<Profile>({
    id: "",
    email: "",
    name: "",
    gender: "",
    age: "",
    phone: "",
    createdAt: "",
  });

  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!active) return;
        if (authError) throw authError;

        if (!user) {
          router.replace("/auth?mode=login&next=%2Fprofile");
          return;
        }

        const metadata = user.user_metadata ?? {};

        if (active) {
          setProfile({
            id: user.id,
            email: user.email ?? "",
            name: String(
              metadata.full_name ?? metadata.name ?? metadata.display_name ?? ""
            ),
            gender: String(metadata.gender ?? ""),
            age: metadata.age != null ? String(metadata.age) : "",
            phone: String(
              metadata.phone_number ?? metadata.phone ?? ""
            ),
            createdAt: user.created_at ?? "",
          });
        }

        const { data, error: ordersError } = await supabase
          .from("orders")
          .select(
            "id, listing_id, buyer_id, seller_id, amount_paise, currency, status, created_at, expires_at, listing:listings(title, category, venue, location, event_date, event_time)"
          )
          .eq("buyer_id", user.id)
          .order("created_at", { ascending: false });

        if (!active) return;
        if (ordersError) throw ordersError;

        setOrders((data ?? []) as unknown as Order[]);
      } catch (err) {
        if (!active) return;
        console.error("Unable to load CineRelay profile:", err);
        setError(
          err instanceof Error
            ? err.message
            : "We could not load your profile. Please try again."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  const paidOrders = useMemo(
    () =>
      orders.filter((order) =>
        ["paid", "completed", "success"].includes(
          order.status.toLowerCase()
        )
      ),
    [orders]
  );

  const pendingOrders = useMemo(
    () =>
      orders.filter((order) =>
        ["pending", "created", "processing"].includes(
          order.status.toLowerCase()
        )
      ),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    if (bookingFilter === "all") return orders;

    if (bookingFilter === "paid") {
      return orders.filter((order) =>
        ["paid", "completed", "success"].includes(
          order.status.toLowerCase()
        )
      );
    }

    if (bookingFilter === "pending") {
      return orders.filter((order) =>
        ["pending", "created", "processing"].includes(
          order.status.toLowerCase()
        )
      );
    }

    return orders.filter((order) =>
      ["failed", "cancelled", "expired"].includes(
        order.status.toLowerCase()
      )
    );
  }, [orders, bookingFilter]);

  const displayName = profile.name.trim() || "CineRelay Member";
  const initials =
    displayName === "CineRelay Member"
      ? "CR"
      : displayName
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase();

  function updateField(field: "name" | "gender" | "age" | "phone", value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
    setError("");
    setNotice("");
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const name = profile.name.trim();
    const ageText = profile.age.trim();
    const phone = profile.phone.trim();

    if (!name) {
      setError("Please enter your full name.");
      return;
    }

    if (ageText) {
      const age = Number(ageText);

      if (!Number.isInteger(age) || age < 13 || age > 120) {
        setError("Enter a valid age between 13 and 120.");
        return;
      }
    }

    if (phone && !/^[+()\d\s-]{7,20}$/.test(phone)) {
      setError("Enter a valid phone number.");
      return;
    }

    setSaving(true);

    try {
      const { data, error: updateError } =
        await supabase.auth.updateUser({
          data: {
            full_name: name,
            gender: profile.gender,
            age: ageText ? Number(ageText) : null,
            phone_number: phone,
          },
        });

      if (updateError) throw updateError;

      const metadata = data.user?.user_metadata ?? {};

      setProfile((current) => ({
        ...current,
        name: String(metadata.full_name ?? name),
        gender: String(metadata.gender ?? ""),
        age: metadata.age != null ? String(metadata.age) : "",
        phone: String(metadata.phone_number ?? ""),
      }));

      setNotice("Your profile details have been saved.");
    } catch (err) {
      console.error("Unable to save profile:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save your details. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    setError("");

    try {
      const { error: logoutError } = await supabase.auth.signOut();

      if (logoutError) throw logoutError;

      router.replace("/auth?mode=login");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to log out."
      );
      setLoggingOut(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090a0c] text-[#f5f2eb]">
      {/* Background atmosphere */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[540px] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-300px] h-[650px] w-[850px] -translate-x-1/2 rounded-full bg-[#d6b36a]/[0.10] blur-[150px]" />
        <div className="absolute right-[-180px] top-40 h-80 w-80 rounded-full bg-violet-900/[0.07] blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      </div>

      {/* Homepage-style navigation */}
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#090a0c]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
          <Link href="/" className="group flex shrink-0 items-center gap-3">
            <CineRelayLogo className="h-10 w-10 shrink-0 transition duration-300 group-hover:-rotate-3" />
            <span className="text-xl font-bold tracking-[-0.06em] sm:text-2xl">
              Cine<span className="text-[#d6b36a]">Relay</span>
            </span>
          </Link>

          <nav className="flex items-center gap-3 sm:gap-6">
            <Link
              href="/"
              className="hidden text-sm text-white/70 transition hover:text-[#f0dcae] sm:inline"
            >
              Discover
            </Link>
            <Link
              href="/my-listings"
              className="hidden text-sm text-white/70 transition hover:text-[#f0dcae] sm:inline"
            >
              My Listings
            </Link>
            <Link
              href="/messages"
              className="hidden text-sm text-white/70 transition hover:text-[#f0dcae] sm:inline"
            >
              Messages
            </Link>
            <Link
              href="/sell"
              className="inline-flex items-center gap-2 rounded-full bg-[#d6b36a] px-4 py-2.5 text-sm font-bold text-[#111111] transition hover:bg-[#f0dcae] sm:px-5"
            >
              + Sell a ticket
            </Link>
          </nav>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1440px] px-5 pb-16 pt-8 sm:px-8 sm:pt-12 lg:px-12">
        {/* Breadcrumb */}
        <div className="mb-7 flex items-center gap-2 text-xs text-white/45">
          <Link href="/" className="transition hover:text-[#e5ca91]">
            Home
          </Link>
          <span>/</span>
          <span className="text-[#e5ca91]">My profile</span>
        </div>

        {/* Page heading */}
        <section className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d6b36a]/25 bg-[#d6b36a]/[0.07] px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#d6b36a]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f0dcae]">
                Your personal space
              </span>
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.065em] text-[#fffaf0] sm:text-5xl">
              My <span className="premium-gold-text">Profile.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
              Manage your account, keep track of your bookings, and make every
              ticket experience count.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-5 py-3 text-sm text-white/80 transition hover:border-[#d6b36a]/35 hover:text-[#f0dcae]"
          >
            ← Explore tickets
          </Link>
        </section>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] px-5 py-4 text-sm text-rose-200"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] px-5 py-4 text-sm text-emerald-200"
          >
            {notice}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-white/[0.08] bg-[#101114]/80 p-10 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#d6b36a]" />
            <p className="mt-4 text-sm text-white/60">
              Preparing your CineRelay account...
            </p>
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
            {/* Profile sidebar */}
            <aside className="space-y-5 lg:sticky lg:top-28">
              <section className="relative overflow-hidden rounded-3xl border border-white/[0.09] bg-[#101114] p-6">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-[#d6b36a]/[0.12] blur-[65px]"
                />

                <div className="relative flex flex-col items-center text-center">
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-[#d6b36a]/45 bg-gradient-to-br from-[#292319] to-[#101114] shadow-[0_0_45px_rgba(214,179,106,0.10)]">
                    <span className="text-3xl font-semibold tracking-tight text-[#f0dcae]">
                      {initials}
                    </span>
                    <span className="absolute bottom-0 right-0 h-5 w-5 rounded-full border-[3px] border-[#101114] bg-emerald-400" />
                  </div>

                  <h2 className="mt-5 max-w-full break-words text-xl font-semibold text-[#fffaf0]">
                    {displayName}
                  </h2>
                  <p className="mt-2 max-w-full break-all text-xs text-white/50">
                    {profile.email || "No email available"}
                  </p>

                  <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#d6b36a]/20 bg-[#d6b36a]/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#e5ca91]">
                    <span>✦</span> CineRelay member
                  </span>

                  {profile.createdAt && (
                    <p className="mt-4 text-[11px] text-white/40">
                      Member since {formatDate(profile.createdAt)}
                    </p>
                  )}
                </div>

                <div className="my-6 border-t border-white/[0.08]" />

                <nav aria-label="Profile navigation" className="space-y-2">
                  {tabs.map((tab) => {
                    const active = activeTab === tab.id;

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(tab.id);
                          setError("");
                          setNotice("");
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition ${
                          active
                            ? "border-[#d6b36a]/30 bg-[#d6b36a]/[0.09] text-[#f0dcae]"
                            : "border-transparent text-white/60 hover:border-white/[0.08] hover:bg-white/[0.035] hover:text-white"
                        }`}
                      >
                        <span className="text-base">{tab.icon}</span>
                        <span>{tab.label}</span>
                        {active && (
                          <span className="ml-auto text-[#d6b36a]">→</span>
                        )}
                      </button>
                    );
                  })}
                </nav>

                <div className="my-5 border-t border-white/[0.08]" />

                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-rose-300/80 transition hover:bg-rose-400/[0.07] hover:text-rose-200 disabled:opacity-50"
                >
                  <span>↗</span>
                  {loggingOut ? "Signing out..." : "Sign out"}
                </button>
              </section>

              <section className="relative overflow-hidden rounded-3xl border border-[#d6b36a]/20 bg-[#151518] p-5">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#d6b36a]/[0.10] blur-[55px]"
                />
                <p className="relative text-[10px] font-semibold uppercase tracking-[0.19em] text-[#d6b36a]">
                  Your next experience
                </p>
                <h3 className="relative mt-3 text-lg font-semibold text-[#fffaf0]">
                  Plans change.
                  <br />
                  <span className="premium-gold-text">Tickets find a way.</span>
                </h3>
                <p className="relative mt-3 text-xs leading-6 text-white/55">
                  Discover tickets shared by the CineRelay community.
                </p>
                <Link
                  href="/"
                  className="relative mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#e5ca91] transition hover:text-white"
                >
                  Discover tickets <span>→</span>
                </Link>
              </section>
            </aside>

            {/* Main profile content */}
            <section className="min-w-0 space-y-6">
              {activeTab === "overview" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      {
                        label: "Total bookings",
                        value: orders.length,
                        icon: "▣",
                        description: "All your orders",
                      },
                      {
                        label: "Confirmed",
                        value: paidOrders.length,
                        icon: "✓",
                        description: "Successfully paid",
                      },
                      {
                        label: "Awaiting payment",
                        value: pendingOrders.length,
                        icon: "◷",
                        description: "Pending orders",
                      },
                    ].map((stat) => (
                      <article
                        key={stat.label}
                        className="rounded-2xl border border-white/[0.08] bg-[#101114] p-5 transition duration-300 hover:-translate-y-0.5 hover:border-[#d6b36a]/25"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/55">
                            {stat.label}
                          </span>
                          <span className="text-lg text-[#d6b36a]">
                            {stat.icon}
                          </span>
                        </div>
                        <p className="mt-4 text-3xl font-semibold tracking-tight text-[#fffaf0]">
                          {stat.value}
                        </p>
                        <p className="mt-2 text-[11px] text-white/40">
                          {stat.description}
                        </p>
                      </article>
                    ))}
                  </div>

                  <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#101114]">
                    <div className="flex flex-col justify-between gap-4 border-b border-white/[0.08] p-5 sm:flex-row sm:items-center sm:p-7">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d6b36a]">
                          Account settings
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#fffaf0]">
                          Personal information
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-white/50">
                          Keep your details accurate for a smoother experience.
                        </p>
                      </div>
                      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] text-white/55">
                        <span className="text-[#d6b36a]">●</span>
                        Account details
                      </span>
                    </div>

                    <form onSubmit={saveProfile} className="p-5 sm:p-7">
                      <div className="grid gap-5 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-2 block text-xs font-medium text-white/70">
                            Full name <span className="text-[#d6b36a]">*</span>
                          </span>
                          <input
                            className="premium-field w-full rounded-xl border border-white/[0.10] bg-black/20 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6b36a]/60 focus:ring-2 focus:ring-[#d6b36a]/10"
                            value={profile.name}
                            onChange={(event) =>
                              updateField("name", event.target.value)
                            }
                            placeholder="Enter your full name"
                            autoComplete="name"
                            required
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-xs font-medium text-white/70">
                            Email address
                          </span>
                          <input
                            className="w-full cursor-not-allowed rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3.5 text-sm text-white/45 outline-none"
                            value={profile.email}
                            readOnly
                            autoComplete="email"
                          />
                          <span className="mt-2 block text-[10px] text-white/35">
                            Your login email is managed by authentication.
                          </span>
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-xs font-medium text-white/70">
                            Gender
                          </span>
                          <select
                            className="premium-field w-full rounded-xl border border-white/[0.10] bg-[#141416] px-4 py-3.5 text-sm text-white outline-none transition focus:border-[#d6b36a]/60 focus:ring-2 focus:ring-[#d6b36a]/10"
                            value={profile.gender}
                            onChange={(event) =>
                              updateField("gender", event.target.value)
                            }
                          >
                            <option value="">Prefer not to say</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Non-binary">Non-binary</option>
                            <option value="Other">Other</option>
                          </select>
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-xs font-medium text-white/70">
                            Age
                          </span>
                          <input
                            className="premium-field w-full rounded-xl border border-white/[0.10] bg-black/20 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6b36a]/60 focus:ring-2 focus:ring-[#d6b36a]/10"
                            type="number"
                            min={13}
                            max={120}
                            value={profile.age}
                            onChange={(event) =>
                              updateField("age", event.target.value)
                            }
                            placeholder="Your age"
                            inputMode="numeric"
                          />
                        </label>

                        <label className="block sm:col-span-2">
                          <span className="mb-2 block text-xs font-medium text-white/70">
                            Phone number
                          </span>
                          <input
                            className="premium-field w-full rounded-xl border border-white/[0.10] bg-black/20 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6b36a]/60 focus:ring-2 focus:ring-[#d6b36a]/10"
                            type="tel"
                            value={profile.phone}
                            onChange={(event) =>
                              updateField("phone", event.target.value)
                            }
                            placeholder="+91 98765 43210"
                            autoComplete="tel"
                          />
                        </label>
                      </div>

                      <div className="mt-7 flex flex-col-reverse gap-3 border-t border-white/[0.08] pt-6 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-[11px] leading-5 text-white/40">
                          Changes are saved to your Supabase user profile.
                        </p>
                        <button
                          type="submit"
                          disabled={saving}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#d6b36a] px-6 py-3.5 text-sm font-bold text-[#111111] transition hover:bg-[#f0dcae] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {saving ? "Saving changes..." : "Save changes"}
                          {!saving && <span>→</span>}
                        </button>
                      </div>
                    </form>
                  </section>

                  <section className="rounded-3xl border border-white/[0.08] bg-[#101114] p-5 sm:p-7">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d6b36a]">
                          Your activity
                        </p>
                        <h2 className="mt-2 text-xl font-semibold text-[#fffaf0]">
                          Recent bookings
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("bookings")}
                        className="shrink-0 text-xs font-semibold text-[#e5ca91] transition hover:text-white"
                      >
                        View all →
                      </button>
                    </div>

                    {orders.length === 0 ? (
                      <div className="mt-6 rounded-2xl border border-dashed border-white/[0.12] px-5 py-9 text-center">
                        <div className="text-3xl text-[#d6b36a]">▣</div>
                        <h3 className="mt-3 font-semibold text-white">
                          Your story starts here
                        </h3>
                        <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-white/45">
                          Your bookings will appear here when you place an order.
                        </p>
                        <Link
                          href="/"
                          className="mt-5 inline-flex rounded-full bg-[#d6b36a] px-5 py-3 text-xs font-bold text-[#111111] transition hover:bg-[#f0dcae]"
                        >
                          Explore tickets
                        </Link>
                      </div>
                    ) : (
                      <div className="mt-5 space-y-3">
                        {orders.slice(0, 3).map((order) => {
                          const listing = getListing(order);

                          return (
                            <Link
                              key={order.id}
                              href={`/listing/${order.listing_id}`}
                              className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition hover:border-[#d6b36a]/25 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#d6b36a]/20 bg-[#d6b36a]/[0.06] text-xl text-[#d6b36a]">
                                  {listing?.category?.toLowerCase() === "movies"
                                    ? "🎬"
                                    : "🎟"}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-white">
                                    {listing?.title || "Ticket booking"}
                                  </p>
                                  <p className="mt-1 text-[11px] text-white/45">
                                    {formatDate(order.created_at)}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                                <span
                                  className={`rounded-full border px-2.5 py-1 text-[10px] capitalize ${getStatusColor(order.status)}`}
                                >
                                  {order.status}
                                </span>
                                <span className="text-sm font-semibold text-[#f0dcae]">
                                  {formatPrice(order.amount_paise, order.currency)}
                                </span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </>
              )}

              {activeTab === "bookings" && (
                <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#101114]">
                  <div className="border-b border-white/[0.08] p-5 sm:p-7">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d6b36a]">
                      Order history
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-[#fffaf0]">
                      My bookings
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-white/50">
                      Review your orders, amounts, and payment status.
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {[
                        ["all", "All orders"],
                        ["paid", "Confirmed"],
                        ["pending", "Pending"],
                        ["other", "Other"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setBookingFilter(value)}
                          className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                            bookingFilter === value
                              ? "border-[#d6b36a]/35 bg-[#d6b36a]/[0.10] text-[#f0dcae]"
                              : "border-white/[0.09] text-white/55 hover:border-white/20 hover:text-white"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 sm:p-7">
                    {filteredOrders.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/[0.12] px-5 py-12 text-center">
                        <div className="text-3xl text-[#d6b36a]">▣</div>
                        <h3 className="mt-4 font-semibold text-white">
                          No bookings in this category
                        </h3>
                        <p className="mt-2 text-xs leading-6 text-white/45">
                          Try another filter or discover available tickets.
                        </p>
                        <Link
                          href="/"
                          className="mt-5 inline-flex rounded-full bg-[#d6b36a] px-5 py-3 text-xs font-bold text-[#111111] transition hover:bg-[#f0dcae]"
                        >
                          Browse tickets
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredOrders.map((order) => {
                          const listing = getListing(order);

                          return (
                            <article
                              key={order.id}
                              className="rounded-2xl border border-white/[0.08] bg-black/15 p-4 sm:p-5"
                            >
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex min-w-0 gap-4">
                                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#d6b36a]/20 bg-[#d6b36a]/[0.06] text-2xl">
                                    {listing?.category?.toLowerCase() === "movies"
                                      ? "🎬"
                                      : "🎟️"}
                                  </div>

                                  <div className="min-w-0">
                                    <h3 className="break-words font-semibold text-[#fffaf0]">
                                      {listing?.title || "Ticket booking"}
                                    </h3>
                                    <p className="mt-1 text-xs text-white/45">
                                      {listing?.category || "Ticket"} ·{" "}
                                      {formatDate(order.created_at)}
                                    </p>
                                    {listing?.venue && (
                                      <p className="mt-2 text-xs text-white/55">
                                        {listing.venue}
                                      </p>
                                    )}
                                    {listing?.location && (
                                      <p className="mt-1 text-xs text-white/45">
                                        {listing.location}
                                      </p>
                                    )}
                                    {listing?.event_date && (
                                      <p className="mt-2 text-xs text-[#e5ca91]">
                                        Event date: {formatDate(listing.event_date)}
                                        {listing.event_time
                                          ? ` · ${listing.event_time}`
                                          : ""}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                                  <span
                                    className={`rounded-full border px-3 py-1.5 text-[10px] capitalize ${getStatusColor(order.status)}`}
                                  >
                                    {order.status}
                                  </span>
                                  <p className="text-lg font-semibold text-[#f0dcae]">
                                    {formatPrice(order.amount_paise, order.currency)}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
                                <p className="text-[10px] text-white/35">
                                  Order ID: {order.id.slice(0, 8)}…
                                </p>
                                <Link
                                  href={`/listing/${order.listing_id}`}
                                  className="text-xs font-semibold text-[#e5ca91] transition hover:text-white"
                                >
                                  View listing →
                                </Link>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {activeTab === "support" && (
                <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#101114]">
                  <div className="relative overflow-hidden border-b border-white/[0.08] p-6 sm:p-9">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-[#d6b36a]/[0.10] blur-[90px]"
                    />
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d6b36a]/25 bg-[#d6b36a]/[0.07] text-2xl text-[#e5ca91]">
                      ✳
                    </div>
                    <h2 className="relative mt-5 text-2xl font-semibold text-[#fffaf0]">
                      How can we help?
                    </h2>
                    <p className="relative mt-2 max-w-lg text-sm leading-7 text-white/55">
                      Have a question about a booking or listing? Reach out to
                      the CineRelay support team.
                    </p>
                  </div>

                  <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
                    <a
                      href="mailto:support@cinerelay.com?subject=CineRelay%20account%20support"
                      className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition hover:border-[#d6b36a]/30 hover:bg-[#d6b36a]/[0.035]"
                    >
                      <span className="text-2xl text-[#d6b36a]">✉</span>
                      <h3 className="mt-4 font-semibold text-white">
                        Email support
                      </h3>
                      <p className="mt-2 break-all text-xs leading-5 text-white/45">
                        support@cinerelay.com
                      </p>
                      <p className="mt-4 text-xs font-semibold text-[#e5ca91]">
                        Contact us →
                      </p>
                    </a>

                    <Link
                      href="/messages"
                      className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition hover:border-[#d6b36a]/30 hover:bg-[#d6b36a]/[0.035]"
                    >
                      <span className="text-2xl text-[#d6b36a]">☏</span>
                      <h3 className="mt-4 font-semibold text-white">
                        Messages
                      </h3>
                      <p className="mt-2 text-xs leading-5 text-white/45">
                        Open your conversations about tickets and sellers.
                      </p>
                      <p className="mt-4 text-xs font-semibold text-[#e5ca91]">
                        View messages →
                      </p>
                    </Link>
                  </div>

                  <p className="px-5 pb-6 text-[10px] leading-5 text-white/35 sm:px-7">
                    Email support will open your email application. It does not
                    create an in-app support ticket.
                  </p>
                </section>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Matching homepage footer */}
      <footer className="relative z-10 border-t border-white/[0.08] bg-black/20">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <Link href="/" className="flex items-center gap-3">
            <CineRelayLogo className="h-8 w-8 shrink-0" />
            <span className="font-bold tracking-[-0.045em] text-white">
              Cine<span className="text-[#d6b36a]">Relay</span>
            </span>
          </Link>

          <p className="text-xs text-white/45">Discover. Connect. Relay.</p>

          <nav className="flex flex-wrap gap-x-5 gap-y-3 text-xs text-white/55">
            <Link
              href="/"
              className="transition-colors hover:text-[#e5ca91]"
            >
              Discover
            </Link>
            <Link
              href="/messages"
              className="transition-colors hover:text-[#e5ca91]"
            >
              Messages
            </Link>
            <Link
              href="/my-listings"
              className="transition-colors hover:text-[#e5ca91]"
            >
              My Listings
            </Link>
            <Link
              href="/sell"
              className="transition-colors hover:text-[#e5ca91]"
            >
              Sell tickets
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
