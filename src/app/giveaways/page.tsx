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

      // Mark locally entered and increment count
      setGiveaways((list) =>
        list.map((g) =>
          g.id === giveaway.id
            ? {
                ...g,
                has_entered: true,
                entries_count: (g.entries_count ?? 0) + 1,
              }
            : g
        )
      );

      setActionNotice({
        id: giveaway.id,
        text: "🎉 You are officially entered! Winners will be drawn when time expires.",
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
              <span className="text-amber-300">🎁</span>
              Giveaways
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
              <span>🎁</span> Host a Giveaway Contest
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
            {categoryPills.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  selectedCategory === cat
                    ? "bg-[#d6b36a] text-[#111111]"
                    : "border border-white/10 bg-white/[0.025] text-white/70 hover:border-white/25 hover:text-white"
                }`}
              >
                {cat === "Movie Tickets" && "🎟️ "}
                {cat === "Gift Cards" && "🎁 "}
                {cat === "Events" && "🎪 "}
                {cat}
              </button>
            ))}
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
            <span className="text-4xl">🎁</span>
            <h3 className="mt-4 text-xl font-semibold text-[#fffaf0]">
              No giveaway contests found
            </h3>
            <p className="mt-2 text-sm text-white/50">
              There are no matching contests right now. Be the first to host one!
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
              className="mt-6 rounded-full bg-[#d6b36a] px-5 py-2.5 text-xs font-bold text-[#111111]"
            >
              + Host a Giveaway
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredGiveaways.map((ga) => {
              const countdown = formatTimeRemaining(ga.end_time);
              const isHost = currentUserId && ga.host_id === currentUserId;
              const hasWon =
                currentUserId &&
                ga.winners.some((w) => w.user_id === currentUserId);

              return (
                <article
                  key={ga.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.09] bg-[#101114] p-6 transition duration-300 hover:border-[#d6b36a]/40 hover:shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
                >
                  <div>
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full border border-[#d6b36a]/30 bg-[#d6b36a]/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#e7ca8d]">
                        {ga.category}
                      </span>

                      {ga.status === "active" && !countdown.isEnded ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                          Live Contest
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-300">
                          <span>🏆</span> Winner Drawn
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

                    {/* Countdown / Status Bar */}
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-black/25 px-3 py-2 text-xs">
                      <span className="text-white/45">
                        {ga.status === "active" && !countdown.isEnded
                          ? "Ends in"
                          : "Contest status"}
                      </span>
                      <span
                        className={`font-mono font-semibold ${
                          ga.status === "active" && !countdown.isEnded
                            ? "text-[#e7ca8d]"
                            : "text-amber-300"
                        }`}
                      >
                        {ga.status === "active" && !countdown.isEnded
                          ? countdown.displayText
                          : "Closed & Awarded"}
                      </span>
                    </div>

                    {/* Participants count */}
                    <p className="mt-2 text-right text-[11px] text-white/45">
                      👥 {ga.entries_count ?? 0} participants entered
                    </p>

                    {/* Winner announcement if ended */}
                    {ga.status === "ended" && ga.winners.length > 0 && (
                      <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.08] p-3 text-xs">
                        <p className="font-bold text-amber-300">
                          🏆 Winning Cinephile:
                        </p>
                        <ul className="mt-1 space-y-1 text-white/80">
                          {ga.winners.map((w, idx) => (
                            <li key={idx} className="flex items-center gap-1.5 font-medium">
                              <span>🎉</span> {w.user_name}
                            </li>
                          ))}
                        </ul>
                        {hasWon && (
                          <p className="mt-2 font-bold text-emerald-400">
                            🌟 Congratulations! You won this contest!
                          </p>
                        )}
                      </div>
                    )}

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
                    {ga.status === "active" && !countdown.isEnded ? (
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
                    {isHost && ga.status === "active" && (
                      <button
                        type="button"
                        onClick={() => void handleDrawWinner(ga.id)}
                        disabled={drawingId === ga.id}
                        className="w-full rounded-xl border border-[#d6b36a]/30 bg-[#d6b36a]/10 py-2.5 text-xs font-semibold text-[#f0dcae] transition hover:bg-[#d6b36a]/20"
                      >
                        {drawingId === ga.id
                          ? "Selecting winner..."
                          : "🎲 Draw Winner Now"}
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
              <div>
                <label className="mb-1 block font-semibold text-white/70">
                  Giveaway Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 2x IMAX 3D Tickets - Deadpool & Wolverine"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white placeholder-white/30 outline-none focus:border-[#d6b36a]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-white/70">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as GiveawayCategory)}
                    className="w-full rounded-xl border border-white/10 bg-[#181a1f] p-3 text-white outline-none focus:border-[#d6b36a]"
                  >
                    <option value="Movie Tickets">Movie Tickets 🎟️</option>
                    <option value="Gift Cards">Gift Cards 🎁</option>
                    <option value="Events">Events 🎪</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-white/70">
                    Approx. Prize Value (₹)
                  </label>
                  <input
                    type="number"
                    value={prizeValue}
                    onChange={(e) => setPrizeValue(e.target.value)}
                    placeholder="e.g. 800"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white placeholder-white/30 outline-none focus:border-[#d6b36a]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-white/70">
                  Prize Details & Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={prizeDetails}
                  onChange={(e) => setPrizeDetails(e.target.value)}
                  placeholder="Describe what the winner will receive (seats, date, voucher platform, terms)..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white placeholder-white/30 outline-none focus:border-[#d6b36a]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-white/70">
                    Venue / Cinema (Optional)
                  </label>
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="e.g. PVR Forum Mall, Bengaluru"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white placeholder-white/30 outline-none focus:border-[#d6b36a]"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-white/70">
                    Movie Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={movieTitle}
                    onChange={(e) => setMovieTitle(e.target.value)}
                    placeholder="e.g. Gladiator II"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white placeholder-white/30 outline-none focus:border-[#d6b36a]"
                  />
                </div>
              </div>

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

              <div>
                <label className="mb-1 block font-semibold text-white/70">
                  How Winner Claims (Claim Instructions)
                </label>
                <input
                  type="text"
                  value={claimInstructions}
                  onChange={(e) => setClaimInstructions(e.target.value)}
                  placeholder="e.g. Digital ticket barcode will be sent via CineRelay Chat"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white placeholder-white/30 outline-none focus:border-[#d6b36a]"
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
