"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Giveaway,
  GiveawayCategory,
  formatTimeRemaining,
} from "@/lib/giveaways";

interface CategoryFieldConfig {
  titleLabel: string;
  titlePlaceholder: string;
  categoryBadge: string;
  venueLabel: string;
  venuePlaceholder: string;
  secondaryLabel: string;
  secondaryPlaceholder: string;
  detailsPlaceholder: string;
  claimPlaceholder: string;
  valuePlaceholder: string;
  quickExamples: string[];
}

function CategoryIcon({
  category,
  className = "h-4 w-4",
}: {
  category: string;
  className?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (category) {
    case "Movies":
    case "Movie Tickets":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="15" rx="2" />
          <path d="M3 10h18M8 5l-3 5M15 5l-3 5M21 5l-3 5" />
          <path d="m10 13 5 3-5 3z" fill="currentColor" stroke="none" />
        </svg>
      );

    case "Events":
      return (
        <svg {...common}>
          <path d="M4 7a2 2 0 0 0 0 4v2a2 2 0 0 0 0 4h16v-4a2 2 0 0 1 0-4V5H4z" />
          <path d="M9 8v1M9 12v1M9 16v1M13 9h3M13 13h3M13 17h3" />
        </svg>
      );

    case "Gift Cards":
    case "Giveaways":
    case "Giveaway":
      return (
        <svg {...common}>
          <rect x="3" y="10" width="18" height="11" rx="2" />
          <path d="M2 7h20v4H2zM12 7v14" />
          <path d="M12 7H8.5a2.5 2.5 0 1 1 2.5-2.5V7ZM12 7h3.5a2.5 2.5 0 1 0-2.5-2.5V7Z" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <rect x="3" y="10" width="18" height="11" rx="2" />
          <path d="M2 7h20v4H2zM12 7v14" />
          <path d="M12 7H8.5a2.5 2.5 0 1 1 2.5-2.5V7ZM12 7h3.5a2.5 2.5 0 1 0-2.5-2.5V7Z" />
        </svg>
      );
  }
}

const CATEGORY_CONFIG: Record<GiveawayCategory, CategoryFieldConfig> = {
  "Movie Tickets": {
    titleLabel: "Movie Ticket Giveaway Title *",
    titlePlaceholder: "e.g. 2x IMAX 3D Tickets — Deadpool & Wolverine",
    categoryBadge: "Movie Tickets 🎬",
    venueLabel: "Cinema / Theatre (Optional)",
    venuePlaceholder: "e.g. PVR INOX Forum Mall, Bengaluru",
    secondaryLabel: "Movie Name (Optional)",
    secondaryPlaceholder: "e.g. Gladiator II, Interstellar",
    detailsPlaceholder: "Describe seats, screen format (IMAX/4DX/2D), showtime, and ticket transfer instructions...",
    claimPlaceholder: "e.g. Digital ticket PDF / barcode will be sent via CineRelay Chat",
    valuePlaceholder: "e.g. 900",
    quickExamples: [
      "🎬 2x IMAX 3D Tickets — Gladiator II",
      "🍿 2x Premium Recliner Passes — Interstellar",
      "🎥 First Day First Show Movie Passes",
    ],
  },
  "Gift Cards": {
    titleLabel: "Gift Card / Voucher Title *",
    titlePlaceholder: "e.g. ₹1,000 BookMyShow E-Gift Voucher",
    categoryBadge: "Gift Cards 🎁",
    venueLabel: "Usable Region / Cinemas (Optional)",
    venuePlaceholder: "e.g. All Theatres Across India (Online Code)",
    secondaryLabel: "Platform / Brand (Optional)",
    secondaryPlaceholder: "e.g. BookMyShow, PVR INOX, Cinepolis",
    detailsPlaceholder: "Describe the voucher value, brand platform, expiry date, and redemption terms...",
    claimPlaceholder: "e.g. Digital voucher code and secret PIN will be messaged securely via CineRelay Chat",
    valuePlaceholder: "e.g. 1000",
    quickExamples: [
      "🎁 ₹1,000 BookMyShow E-Gift Voucher",
      "💳 ₹500 PVR Cinemas Digital Gift Card",
      "🎟️ ₹1,500 Any-Cinema Weekend Voucher",
    ],
  },
  "Events": {
    titleLabel: "Live Event Pass Title *",
    titlePlaceholder: "e.g. 2x VIP Passes — Stand-up Comedy Special by Zakir Khan",
    categoryBadge: "Events 🎟️",
    venueLabel: "Event Venue & City (Optional)",
    venuePlaceholder: "e.g. Siri Fort Auditorium, New Delhi",
    secondaryLabel: "Performer / Event Name (Optional)",
    secondaryPlaceholder: "e.g. Zakir Khan Live, Sunburn Festival",
    detailsPlaceholder: "Describe the event date & time, pass tier (VIP, Fan Pit, General Entry), and entry requirements...",
    claimPlaceholder: "e.g. Official event pass QR badge / PDF will be sent via CineRelay Chat",
    valuePlaceholder: "e.g. 1500",
    quickExamples: [
      "🎟️ 2x Passes — Stand-up Comedy Special by Zakir Khan",
      "🎵 2x Fanpit Concert Passes — Live Tour",
      "🎭 VIP Access Pass — Weekend Comedy Festival",
    ],
  },
};

export default function GiveawaysPage() {
  const router = useRouter();
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "ended">("active");

  // User auth state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("");

  // Modal state
  const [showHostModal, setShowHostModal] = useState(false);
  const [hostLoading, setHostLoading] = useState(false);
  const [hostError, setHostError] = useState("");
  const [hostSuccess, setHostSuccess] = useState("");

  // Form fields
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<GiveawayCategory>("Movie Tickets");
  const [prizeDetails, setPrizeDetails] = useState("");
  const [prizeValue, setPrizeValue] = useState("");
  const [venue, setVenue] = useState("");
  const [movieTitle, setMovieTitle] = useState("");
  const [durationDays, setDurationDays] = useState("3");
  const [winnersCount, setWinnersCount] = useState("1");
  const [claimInstructions, setClaimInstructions] = useState("");

  // Entry loading tracking
  const [enteringId, setEnteringId] = useState<string | null>(null);
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{
    id: string;
    text: string;
    isError?: boolean;
  } | null>(null);

  // Participant roster & Winner edit tracking
  const [expandedParticipants, setExpandedParticipants] = useState<Record<string, boolean>>({});
  const [editingWinnerId, setEditingWinnerId] = useState<string | null>(null);
  const [winnerInput, setWinnerInput] = useState("");
  const [submittingWinner, setSubmittingWinner] = useState(false);

  function toggleExpandedParticipants(id: string) {
    setExpandedParticipants((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  // Periodic tick for live countdown timers
  const [, setTimerTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimerTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch current user
  useEffect(() => {
    async function checkUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
          const meta = user.user_metadata ?? {};
          setCurrentUserName(
            meta.full_name ?? meta.name ?? user.email?.split("@")[0] ?? "Cinephile"
          );
        }
      } catch {
        // Continue guest
      }
    }
    void checkUser();
  }, []);

  // Fetch giveaways
  async function loadGiveaways() {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/giveaways", { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.giveaways)) {
          setGiveaways(data.giveaways);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch giveaways:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGiveaways();
  }, []);

  // Enter giveaway
  async function handleEnter(giveaway: Giveaway) {
    if (giveaway.status === "ended") return;

    if (!currentUserId) {
      router.push(`/auth?mode=login&next=${encodeURIComponent("/giveaways")}`);
      return;
    }

    setEnteringId(giveaway.id);
    setActionNotice(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(`/api/giveaways/${giveaway.id}/enter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        setActionNotice({
          id: giveaway.id,
          text: json.error || "Could not enter contest.",
          isError: true,
        });
        return;
      }

      // Mark locally entered and increment count, and immediately update participants list
      setGiveaways((list) =>
        list.map((g) => {
          if (g.id !== giveaway.id) return g;
          const currentList = g.participants ?? [];
          const alreadyIn = currentList.some((p) => p.user_id === currentUserId);
          const updatedParticipants = alreadyIn
            ? currentList
            : [
                ...currentList,
                {
                  user_id: currentUserId,
                  user_name: currentUserName || "Cinephile Participant",
                  created_at: new Date().toISOString(),
                },
              ];

          return {
            ...g,
            has_entered: true,
            entries_count: (g.entries_count ?? 0) + 1,
            participants: updatedParticipants,
          };
        })
      );

      setActionNotice({
        id: giveaway.id,
        text: "🎉 You are officially entered! Best of luck in the contest!",
        isError: false,
      });
    } catch (err) {
      console.error("Enter giveaway failed:", err);
      setActionNotice({
        id: giveaway.id,
        text: "Network error entering contest. Please try again.",
        isError: true,
      });
    } finally {
      setEnteringId(null);
    }
  }

  // Draw winner
  async function handleDrawWinner(giveawayId: string) {
    setDrawingId(giveawayId);
    setActionNotice(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(`/api/giveaways/${giveawayId}/draw`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        setActionNotice({
          id: giveawayId,
          text: json.error || "Could not draw winner.",
          isError: true,
        });
        return;
      }

      // Update state
      setGiveaways((list) =>
        list.map((g) =>
          g.id === giveawayId
            ? {
                ...g,
                status: "ended",
                winners: json.winners ?? g.winners,
              }
            : g
        )
      );

      setActionNotice({
        id: giveawayId,
        text: "🏆 Winner successfully selected and announced!",
        isError: false,
      });
    } catch {
      setActionNotice({
        id: giveawayId,
        text: "Could not draw winner.",
        isError: true,
      });
    } finally {
      setDrawingId(null);
    }
  }

  // Host manually announces or edits the winner name
  async function handleAnnounceWinner(giveawayId: string) {
    const name = winnerInput.trim();
    if (!name) {
      setActionNotice({
        id: giveawayId,
        text: "Please type the winner's name.",
        isError: true,
      });
      return;
    }

    setSubmittingWinner(true);
    setActionNotice(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(`/api/giveaways/${giveawayId}/announce-winner`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ winnerName: name }),
      });

      const json = await res.json();

      if (!res.ok) {
        setActionNotice({
          id: giveawayId,
          text: json.error || "Could not announce winner.",
          isError: true,
        });
        return;
      }

      const announcedWinners = [
        {
          user_id: `winner-${Date.now().toString(36)}`,
          user_name: name,
          drawn_at: new Date().toISOString(),
        },
      ];

      // Update giveaway state immediately: status becomes ended (not active), winner becomes announced name
      setGiveaways((list) =>
        list.map((g) =>
          g.id === giveawayId
            ? {
                ...g,
                status: "ended",
                winners: announcedWinners,
              }
            : g
        )
      );

      setEditingWinnerId(null);
      setWinnerInput("");
      setActionNotice({
        id: giveawayId,
        text: `🏆 Winner updated to "${name}"! Contest is now closed.`,
        isError: false,
      });
    } catch (err) {
      console.error("Announce winner error:", err);
      setActionNotice({
        id: giveawayId,
        text: "Network error updating winner name.",
        isError: true,
      });
    } finally {
      setSubmittingWinner(false);
    }
  }

  // Create giveaway
  async function handleCreateGiveaway(e: React.FormEvent) {
    e.preventDefault();
    setHostError("");
    setHostSuccess("");

    if (!title.trim() || !prizeDetails.trim()) {
      setHostError("Please provide a contest title and prize description.");
      return;
    }

    setHostLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const days = Number(durationDays) || 3;
      const calculatedEndTime = new Date(
        Date.now() + days * 24 * 60 * 60 * 1000
      ).toISOString();

      const payload = {
        title: title.trim(),
        category,
        prize_details: prizeDetails.trim(),
        prize_value: Number(prizeValue) || 0,
        venue: venue.trim() || null,
        movie_title: movieTitle.trim() || null,
        end_time: calculatedEndTime,
        winners_count: Number(winnersCount) || 1,
        claim_instructions: claimInstructions.trim() || null,
      };

      const res = await fetch("/api/giveaways", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setHostError(data.error || "Failed to launch giveaway contest.");
        return;
      }

      setHostSuccess("✨ Your giveaway contest is now live on CineRelay!");
      if (data.giveaway) {
        setGiveaways((list) => [data.giveaway, ...list]);
      }

      setTimeout(() => {
        setShowHostModal(false);
        setTitle("");
        setPrizeDetails("");
        setPrizeValue("");
        setVenue("");
        setMovieTitle("");
        setHostSuccess("");
      }, 1500);
    } catch {
      setHostError("Network error while creating giveaway contest.");
    } finally {
      setHostLoading(false);
    }
  }

  // Filtered giveaways
  const filteredGiveaways = useMemo(() => {
    const q = search.trim().toLowerCase();

    return giveaways.filter((item) => {
      const matchesCategory =
        selectedCategory === "All" || item.category === selectedCategory;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.status === "active") ||
        (statusFilter === "ended" && item.status === "ended");

      const text = `${item.title} ${item.category} ${item.prize_details} ${item.venue ?? ""} ${item.host_name} ${item.movie_title ?? ""}`.toLowerCase();
      const matchesSearch = !q || text.includes(q);

      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [giveaways, selectedCategory, statusFilter, search]);

  const categoryPills = ["All", "Movie Tickets", "Gift Cards", "Events"];

  return (
    <main className="min-h-screen overflow-hidden bg-[#090a0c] text-[#f5f2eb]">
      {/* Background atmosphere */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute left-[30%] top-[-200px] h-[650px] w-[850px] rounded-full bg-[#d6b36a]/[0.085] blur-[150px]" />
        <div className="absolute right-[-150px] top-[20%] h-[500px] w-[500px] rounded-full bg-violet-900/[0.06] blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#090a0c]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-5 py-4 sm:px-8 lg:px-12">
          <Link href="/" className="group flex shrink-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d6b36a]/30 bg-[#d6b36a]/[0.08] text-xl text-[#e5ca91]">
              ◈
            </span>
            <span className="text-xl font-bold tracking-[-0.06em] sm:text-2xl">
              Cine<span className="text-[#d6b36a]">Relay</span>
            </span>
          </Link>

          <nav className="flex items-center gap-3 text-xs sm:gap-6 sm:text-sm">
            <Link
              href="/"
              className="hidden text-white/75 transition hover:text-[#f0dcae] sm:inline"
            >
              Explore
            </Link>

            <Link
              href="/giveaways"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#d6b36a]/40 bg-[#d6b36a]/15 px-3 py-1.5 text-xs font-semibold text-[#f0dcae]"
            >
              <CategoryIcon category="Giveaways" className="h-3.5 w-3.5 text-[#f0dcae]" />
              <span>Giveaways</span>
            </Link>

            <Link
              href="/my-listings"
              className="hidden text-white/75 transition hover:text-[#f0dcae] sm:inline"
            >
              My Listings
            </Link>

            <Link
              href="/messages"
              className="hidden text-white/75 transition hover:text-[#f0dcae] sm:inline"
            >
              Messages
            </Link>

            <Link
              href="/profile"
              className="hidden text-white/75 transition hover:text-[#f0dcae] sm:inline"
            >
              Profile
            </Link>

            <button
              type="button"
              onClick={() => {
                if (!currentUserId) {
                  router.push(`/auth?mode=login&next=${encodeURIComponent("/giveaways")}`);
                } else {
                  setShowHostModal(true);
                }
              }}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#d6b36a] to-[#ebce8e] px-4 py-2.5 text-xs font-bold text-[#111111] shadow transition hover:brightness-110 sm:text-sm"
            >
              + Host a Giveaway
            </button>
          </nav>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative px-5 pb-10 pt-12 sm:px-8 sm:pb-16 sm:pt-20 lg:px-12">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d6b36a]/30 bg-[#d6b36a]/[0.08] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#e7ca8d]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#d6b36a]" />
            Community Contests & Free Rewards
          </div>

          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.05em] text-[#fffaf0] sm:text-6xl lg:text-7xl">
            Win Movie Tickets & <br className="hidden sm:inline" />
            <span className="italic text-[#d6b36a]">Gift Cards</span> for free.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-sm leading-8 text-white/60 sm:text-base sm:leading-8">
            Enter 1-click free giveaway contests hosted by fellow movie lovers and members, or host your own giveaway to pass on spare tickets and vouchers to true cinephiles.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={() => {
                if (!currentUserId) {
                  router.push(`/auth?mode=login&next=${encodeURIComponent("/giveaways")}`);
                } else {
                  setShowHostModal(true);
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#d6b36a] to-[#ebce8e] px-6 py-3.5 text-sm font-bold text-[#111111] shadow-lg shadow-[#d6b36a]/15 transition hover:brightness-110"
            >
              <CategoryIcon category="Giveaways" className="h-4 w-4 text-[#111111]" />
              <span>Host a Giveaway Contest</span>
            </button>

            <a
              href="#contest-list"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-white/80 transition hover:border-[#d6b36a]/40 hover:text-white"
            >
              Browse Active Contests ↓
            </a>
          </div>

          {/* Quick Stats Bar */}
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-center">
              <p className="text-2xl font-bold text-[#e5ca91] sm:text-3xl">
                {giveaways.filter((g) => g.status === "active").length}
              </p>
              <p className="mt-1 text-xs text-white/50">Active Contests Live</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400 sm:text-3xl">
                {giveaways.reduce((acc, g) => acc + (g.entries_count ?? 0), 0)}+
              </p>
              <p className="mt-1 text-xs text-white/50">Contest Entries</p>
            </div>
            <div className="col-span-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-center sm:col-span-1">
              <p className="text-2xl font-bold text-amber-300 sm:text-3xl">100% Free</p>
              <p className="mt-1 text-xs text-white/50">No Purchase Needed</p>
            </div>
          </div>
        </div>
      </section>

      {/* CONTESTS FILTER & LIST */}
      <section id="contest-list" className="mx-auto max-w-[1440px] px-5 pb-20 sm:px-8 lg:px-12">
        {/* Search & Category Header */}
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2">
            {categoryPills.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                    active
                      ? "bg-[#d6b36a] text-[#111111]"
                      : "border border-white/10 bg-white/[0.025] text-white/70 hover:border-white/25 hover:text-white"
                  }`}
                >
                  {cat !== "All" && (
                    <CategoryIcon
                      category={cat}
                      className={`h-3.5 w-3.5 shrink-0 ${
                        active ? "text-[#111111]" : "text-[#d6b36a]"
                      }`}
                    />
                  )}
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>

          {/* Status & Search Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl border border-white/10 bg-white/[0.02] p-1 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`rounded-lg px-3 py-1.5 font-medium transition ${
                  statusFilter === "active"
                    ? "bg-[#d6b36a]/20 text-[#f0dcae]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Live Contests
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("ended")}
                className={`rounded-lg px-3 py-1.5 font-medium transition ${
                  statusFilter === "ended"
                    ? "bg-[#d6b36a]/20 text-[#f0dcae]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Past Winners 🏆
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded-lg px-3 py-1.5 font-medium transition ${
                  statusFilter === "all"
                    ? "bg-[#d6b36a]/20 text-[#f0dcae]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                All
              </button>
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contests..."
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-white placeholder-white/35 outline-none transition focus:border-[#d6b36a]/50"
            />
          </div>
        </div>

        {/* GIVEAWAY CARDS GRID */}
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-96 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]"
              />
            ))}
          </div>
        ) : filteredGiveaways.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#d6b36a]/30 bg-[#d6b36a]/10">
              <CategoryIcon category="Giveaways" className="h-8 w-8 text-[#d6b36a]" />
            </div>
            <h3 className="mt-5 text-xl font-semibold text-[#fffaf0]">
              No active giveaways right now
            </h3>
            <p className="mt-2 text-sm text-white/50">
              Contests will appear here when users host ticket or gift card giveaways. Be the first to create one!
            </p>
            <button
              type="button"
              onClick={() => {
                if (!currentUserId) {
                  router.push(`/auth?mode=login&next=${encodeURIComponent("/giveaways")}`);
                } else {
                  setShowHostModal(true);
                }
              }}
              className="mt-6 rounded-full bg-[#d6b36a] px-6 py-2.5 text-xs font-bold text-[#111111] hover:bg-[#e7ca8d] transition"
            >
              + Host a Giveaway
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredGiveaways.map((ga) => {
              const countdown = formatTimeRemaining(ga.end_time);
              const isActive = ga.status === "active" && !countdown.isEnded;
              const isHost = currentUserId && ga.host_id === currentUserId;
              const hasWon =
                currentUserId &&
                ga.winners &&
                ga.winners.some((w) => w.user_id === currentUserId);

              return (
                <article
                  key={ga.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.09] bg-[#101114] p-6 transition duration-300 hover:border-[#d6b36a]/40 hover:shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
                >
                  <div>
                    {/* Top Badges: Category on left, Active (Green) / Not Active (Red) on right */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d6b36a]/30 bg-[#d6b36a]/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#e7ca8d]">
                        <CategoryIcon category={ga.category} className="h-3 w-3 text-[#d6b36a]" />
                        <span>{ga.category}</span>
                      </span>

                      {isActive ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                          Active Contest
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-400">
                          <span className="h-2 w-2 rounded-full bg-rose-500" />
                          Not Active
                        </span>
                      )}
                    </div>

                    {/* Title & Host */}
                    <h2 className="mt-4 text-xl font-semibold leading-snug tracking-[-0.03em] text-[#fffaf0]">
                      {ga.title}
                    </h2>

                    <p className="mt-1 text-xs text-white/45">
                      Hosted by{" "}
                      <span className="font-medium text-white/70">
                        {ga.host_name}
                      </span>
                    </p>

                    {/* Details */}
                    <p className="mt-4 text-xs leading-6 text-white/70 line-clamp-3">
                      {ga.prize_details}
                    </p>

                    {/* Venue / Movie info */}
                    {ga.venue && (
                      <div className="mt-4 flex items-center gap-2 text-xs text-white/60">
                        <span className="text-[#d6b36a]">📍</span>
                        <span className="line-clamp-1">{ga.venue}</span>
                      </div>
                    )}

                    {/* Prize value & winner count */}
                    <div className="mt-5 grid grid-cols-2 gap-2 border-y border-white/[0.07] py-3 text-xs">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-white/40">
                          Prize Value
                        </span>
                        <p className="mt-0.5 font-semibold text-[#f0dcae]">
                          {ga.prize_value > 0 ? `₹${ga.prize_value}` : "Free Pass"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-white/40">
                          Winners
                        </span>
                        <p className="mt-0.5 font-semibold text-white/85">
                          {ga.winners_count}{" "}
                          {ga.winners_count === 1 ? "Winner" : "Winners"}
                        </p>
                      </div>
                    </div>

                    {/* Winner Display: "Winner : _____ ?" placeholder or announced winner name */}
                    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🏆</span>
                          <span className="font-mono text-xs font-semibold">
                            Winner :{" "}
                            {ga.winners && ga.winners.length > 0 ? (
                              <span className="font-bold text-[#f5dfb0]">
                                {ga.winners.map((w) => w.user_name).join(", ")}
                              </span>
                            ) : (
                              <span className="font-bold tracking-wider text-amber-200/80">
                                _____ ?
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Host Edit Winner Option */}
                        {isHost && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingWinnerId(editingWinnerId === ga.id ? null : ga.id);
                              setWinnerInput(ga.winners?.[0]?.user_name ?? "");
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#d6b36a]/40 bg-[#d6b36a]/15 px-2.5 py-1 text-[11px] font-semibold text-[#f0dcae] transition hover:bg-[#d6b36a]/25"
                          >
                            <span>✏️</span>
                            <span>{ga.winners && ga.winners.length > 0 ? "Edit Winner" : "Name Winner"}</span>
                          </button>
                        )}
                      </div>

                      {/* Inline Host Winner Editor */}
                      {isHost && editingWinnerId === ga.id && (
                        <div className="mt-3 border-t border-white/10 pt-3">
                          <label className="block text-[11px] font-medium text-white/75 mb-1.5">
                            Name or select the winner:
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={winnerInput}
                              onChange={(e) => setWinnerInput(e.target.value)}
                              placeholder="Type winner name..."
                              className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-[#d6b36a]"
                              autoFocus
                            />
                            <button
                              type="button"
                              disabled={submittingWinner || !winnerInput.trim()}
                              onClick={() => void handleAnnounceWinner(ga.id)}
                              className="rounded-lg bg-gradient-to-r from-[#d6b36a] to-[#ebce8e] px-3.5 py-1.5 text-xs font-bold text-[#111111] hover:brightness-110 disabled:opacity-50"
                            >
                              {submittingWinner ? "Saving..." : "Save Winner 🏆"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingWinnerId(null)}
                              className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/50 hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>

                          {/* Quick pick from joined participants */}
                          {ga.participants && ga.participants.length > 0 && (
                            <div className="mt-2.5">
                              <span className="text-[10px] text-white/40 block mb-1">
                                Quick select from joined members:
                              </span>
                              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                                {ga.participants.map((p, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setWinnerInput(p.user_name)}
                                    className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/75 hover:border-[#d6b36a]/50 hover:bg-[#d6b36a]/15 hover:text-[#f5dfb0]"
                                  >
                                    + {p.user_name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Celebration banner for winning user */}
                      {hasWon && (
                        <p className="mt-2 text-[11px] font-bold text-emerald-400">
                          🎉 Congratulations! You are the winner of this giveaway!
                        </p>
                      )}
                    </div>

                    {/* Time Remaining Bar: Shows detailed remaining minutes & seconds */}
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-black/35 px-3 py-2 text-xs">
                      <span className="text-white/50">
                        {isActive ? "⏳ Time Remaining" : "Contest Status"}
                      </span>
                      <span
                        className={`font-mono text-xs font-semibold ${
                          isActive ? "text-[#e7ca8d]" : "text-rose-400"
                        }`}
                      >
                        {isActive ? countdown.detailedMinutesText : "Contest Closed"}
                      </span>
                    </div>

                    {/* Members Joined Count & Expandable Participant Roster */}
                    <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-white/65">
                          👥{" "}
                          <strong className="text-white">
                            {ga.participants?.length ?? ga.entries_count ?? 0}
                          </strong>{" "}
                          {(ga.participants?.length ?? ga.entries_count ?? 0) === 1
                            ? "member joined"
                            : "members joined"}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleExpandedParticipants(ga.id)}
                          className="text-[11px] font-semibold text-[#d6b36a] hover:underline"
                        >
                          {expandedParticipants[ga.id]
                            ? "Hide roster ↑"
                            : "See who joined ↓"}
                        </button>
                      </div>

                      {/* Expandable list of who joined */}
                      {expandedParticipants[ga.id] && (
                        <div className="mt-2.5 border-t border-white/[0.08] pt-2.5">
                          {ga.participants && ga.participants.length > 0 ? (
                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                              {ga.participants.map((p, idx) => {
                                const isUser = currentUserId && p.user_id === currentUserId;
                                const isWinner = ga.winners?.some(
                                  (w) =>
                                    w.user_id === p.user_id ||
                                    w.user_name.toLowerCase() === p.user_name.toLowerCase()
                                );

                                return (
                                  <div
                                    key={idx}
                                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] ${
                                      isWinner
                                        ? "border border-amber-400/40 bg-amber-400/10 text-amber-200"
                                        : isUser
                                        ? "border border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                                        : "bg-white/[0.03] text-white/75"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold uppercase text-[#f0dcae]">
                                        {p.user_name.charAt(0)}
                                      </span>
                                      <span className="font-medium">
                                        {p.user_name}
                                        {isUser && " (You)"}
                                      </span>
                                    </div>
                                    {isWinner ? (
                                      <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                                        🏆 Winner
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-white/40">Joined</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="py-1 text-[11px] text-white/40 italic">
                              No participants have entered yet. Be the first to join!
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action notification */}
                    {actionNotice && actionNotice.id === ga.id && (
                      <div
                        role="alert"
                        className={`mt-4 rounded-xl p-3 text-xs leading-5 ${
                          actionNotice.isError
                            ? "border border-red-400/25 bg-red-400/[0.08] text-red-200"
                            : "border border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200"
                        }`}
                      >
                        {actionNotice.text}
                      </div>
                    )}
                  </div>

                  {/* Actions Bottom */}
                  <div className="mt-6 space-y-2 pt-2">
                    {isActive ? (
                      ga.has_entered ? (
                        <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 py-3 text-xs font-semibold text-emerald-300">
                          <span>✓</span> You&apos;re Entered! Good Luck 🎟️
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleEnter(ga)}
                          disabled={enteringId === ga.id}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d6b36a] to-[#ebce8e] py-3 text-xs font-bold text-[#111111] shadow transition hover:brightness-110 disabled:opacity-50"
                        >
                          {enteringId === ga.id
                            ? "Entering contest..."
                            : "Enter Giveaway (Free) →"}
                        </button>
                      )
                    ) : (
                      <div className="flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-xs text-white/50">
                        Contest Completed
                      </div>
                    )}

                    {/* Host action: Draw Winner */}
                    {isHost && isActive && (
                      <button
                        type="button"
                        onClick={() => void handleDrawWinner(ga.id)}
                        disabled={drawingId === ga.id}
                        className="w-full rounded-xl border border-[#d6b36a]/30 bg-[#d6b36a]/10 py-2.5 text-xs font-semibold text-[#f0dcae] transition hover:bg-[#d6b36a]/20"
                      >
                        {drawingId === ga.id
                          ? "Selecting winner..."
                          : "🎲 Draw Random Winner"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* HOST A GIVEAWAY MODAL */}
      {showHostModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        >
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-[#111317] p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#d6b36a]">
                  Community Rewards
                </span>
                <h2 className="text-xl font-bold text-[#fffaf0]">
                  Host a Giveaway Contest
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowHostModal(false)}
                className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGiveaway} className="mt-6 space-y-4 text-xs">
              {/* Category Selector at Top */}
              <div>
                <label className="mb-2 block font-semibold text-white/80">
                  Select Prize Category *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Movie Tickets", "Gift Cards", "Events"] as GiveawayCategory[]).map((cat) => {
                    const active = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition ${
                          active
                            ? "border-[#d6b36a] bg-[#d6b36a]/15 text-[#f5dfb0] shadow-sm"
                            : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                            active
                              ? "bg-[#d6b36a]/25 text-[#f5dfb0]"
                              : "bg-white/[0.06] text-white/70"
                          }`}
                        >
                          <CategoryIcon category={cat} className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] font-bold leading-tight">{cat}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Title based on Category */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block font-semibold text-white/80">
                    {CATEGORY_CONFIG[category]?.titleLabel ?? "Giveaway Title *"}
                  </label>
                  <span className="text-[10px] text-[#d6b36a]">
                    {CATEGORY_CONFIG[category]?.categoryBadge}
                  </span>
                </div>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={CATEGORY_CONFIG[category]?.titlePlaceholder}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white placeholder-white/35 outline-none focus:border-[#d6b36a]"
                />

                {/* Quick Example Ideas */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-white/40">Quick ideas:</span>
                  {CATEGORY_CONFIG[category]?.quickExamples.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setTitle(ex)}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/70 transition hover:border-[#d6b36a]/50 hover:bg-[#d6b36a]/10 hover:text-[#f5dfb0]"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              {/* Approx Value */}
              <div>
                <label className="mb-1 block font-semibold text-white/70">
                  Approx. Prize Value (₹)
                </label>
                <input
                  type="number"
                  value={prizeValue}
                  onChange={(e) => setPrizeValue(e.target.value)}
                  placeholder={CATEGORY_CONFIG[category]?.valuePlaceholder}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white placeholder-white/35 outline-none focus:border-[#d6b36a]"
                />
              </div>

              {/* Dynamic Prize Details */}
              <div>
                <label className="mb-1 block font-semibold text-white/70">
                  Prize Details & Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={prizeDetails}
                  onChange={(e) => setPrizeDetails(e.target.value)}
                  placeholder={CATEGORY_CONFIG[category]?.detailsPlaceholder}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white placeholder-white/35 outline-none focus:border-[#d6b36a]"
                />
              </div>

              {/* Dynamic Venue and Movie/Platform fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-white/70">
                    {CATEGORY_CONFIG[category]?.venueLabel}
                  </label>
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder={CATEGORY_CONFIG[category]?.venuePlaceholder}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white placeholder-white/35 outline-none focus:border-[#d6b36a]"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-white/70">
                    {CATEGORY_CONFIG[category]?.secondaryLabel}
                  </label>
                  <input
                    type="text"
                    value={movieTitle}
                    onChange={(e) => setMovieTitle(e.target.value)}
                    placeholder={CATEGORY_CONFIG[category]?.secondaryPlaceholder}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white placeholder-white/35 outline-none focus:border-[#d6b36a]"
                  />
                </div>
              </div>

              {/* Duration and Winners */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-white/70">
                    Contest Duration
                  </label>
                  <select
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#181a1f] p-3 text-white outline-none focus:border-[#d6b36a]"
                  >
                    <option value="1">1 Day</option>
                    <option value="2">2 Days</option>
                    <option value="3">3 Days (Recommended)</option>
                    <option value="5">5 Days</option>
                    <option value="7">7 Days</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-white/70">
                    Number of Winners
                  </label>
                  <select
                    value={winnersCount}
                    onChange={(e) => setWinnersCount(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#181a1f] p-3 text-white outline-none focus:border-[#d6b36a]"
                  >
                    <option value="1">1 Winner</option>
                    <option value="2">2 Winners</option>
                    <option value="3">3 Winners</option>
                    <option value="5">5 Winners</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Claim Instructions */}
              <div>
                <label className="mb-1 block font-semibold text-white/70">
                  How Winner Claims (Claim Instructions)
                </label>
                <input
                  type="text"
                  value={claimInstructions}
                  onChange={(e) => setClaimInstructions(e.target.value)}
                  placeholder={CATEGORY_CONFIG[category]?.claimPlaceholder}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white placeholder-white/35 outline-none focus:border-[#d6b36a]"
                />
              </div>

              {hostError && (
                <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-red-200">
                  {hostError}
                </p>
              )}

              {hostSuccess && (
                <p role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-emerald-200 font-semibold">
                  {hostSuccess}
                </p>
              )}

              <button
                type="submit"
                disabled={hostLoading}
                className="mt-6 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#d6b36a] to-[#ebce8e] py-3.5 text-sm font-bold text-[#111111] transition hover:brightness-110 disabled:opacity-50"
              >
                {hostLoading ? "Launching Contest..." : "Launch Giveaway Contest 🚀"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
