
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase, isConfigured } from "@/lib/supabase";
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
  tmdb_movie_id: number | null;
};

type MovieDetails = {
  posterUrl: string | null;
};

const categories = [
  "All",
  "Movies",
  "Events",
  "Gift Cards",
  "Trains",
  "Buses",
];

const categoryColors: Record<string, string> = {
  Movies: "#c4a7ff",
  Events: "#ff8aa5",
  "Gift Cards": "#f0c56e",
  Trains: "#87c7ff",
  Buses: "#8ed9b2",
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(price);
}

function formatDate(date: string) {
  const parsedDate = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) return date;

  return parsedDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function CategoryIcon({
  category,
  className = "h-6 w-6",
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
      return (
        <svg {...common}>
          <rect x="3" y="10" width="18" height="11" rx="2" />
          <path d="M2 7h20v4H2zM12 7v14" />
          <path d="M12 7H8.5a2.5 2.5 0 1 1 2.5-2.5V7ZM12 7h3.5a2.5 2.5 0 1 0-2.5-2.5V7Z" />
        </svg>
      );

    case "Trains":
      return (
        <svg {...common}>
          <rect x="5" y="2.5" width="14" height="16" rx="4" />
          <path d="M8 7h8M8 12h.01M16 12h.01M8 18.5l-3 3M16 18.5l3 3M8 15h8" />
        </svg>
      );

    case "Buses":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="16" rx="3" />
          <path d="M3 12h18M7 7h3M14 7h3M7 19v2M17 19v2" />
          <circle cx="7" cy="15.5" r="1" />
          <circle cx="17" cy="15.5" r="1" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M7 12h10" />
        </svg>
      );
  }
}

function LogoMark({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f4dfac] to-[#bd9345] font-black text-[#111111] shadow-[0_0_25px_rgba(214,179,106,0.12)] ${
        small ? "h-8 w-8 text-sm" : "h-10 w-10 text-lg"
      }`}
    >
      C
    </span>
  );
}

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedCity, setSelectedCity] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [moviePosters, setMoviePosters] = useState<
    Record<number, string | null>
  >({});

  useEffect(() => {
    let active = true;

    async function fetchListings() {
      setLoading(true);

      if (!isConfigured) {
        console.warn(
          "CineRelay warning: Supabase credentials are not configured in environment variables."
        );
        if (active) {
          setListings([]);
          setErrorMessage(
            process.env.NODE_ENV === "development"
              ? "Database credentials are not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
              : "We couldn't load listings right now. Please try again."
          );
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from("listings")
          .select(
            "id, title, category, venue, location, price, description, event_date, event_time, status, created_at, tmdb_movie_id"
          )
          .eq("status", "approved")
          .order("created_at", { ascending: false });

        if (!active) return;
        if (error) {
          console.error("Failed to load listings from Supabase:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
          throw error;
        }

        setListings((data ?? []) as Listing[]);
        setErrorMessage("");
      } catch (error) {
        const errObj =
          error && typeof error === "object"
            ? (error as {
                message?: string;
                details?: string;
                hint?: string;
                code?: string;
              })
            : null;

        console.error("Failed to load listings:", {
          message:
            errObj?.message ||
            (error instanceof Error ? error.message : String(error)),
          details: errObj?.details,
          hint: errObj?.hint,
          code: errObj?.code,
        });

        if (active) {
          setListings([]);
          const isDev = process.env.NODE_ENV === "development";
          const devHint =
            isDev && errObj?.message ? ` (${errObj.message})` : "";
          setErrorMessage(
            `We couldn't load listings right now. Please try again.${devHint}`
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchListings();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const fetchedPosterIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    let active = true;

    const movieIds = Array.from(
      new Set(
        listings
          .filter(
            (listing) =>
              listing.category === "Movies" &&
              listing.tmdb_movie_id !== null
          )
          .map((listing) => Number(listing.tmdb_movie_id))
          .filter((id) => Number.isSafeInteger(id) && id > 0)
      )
    );

    const missingIds = movieIds.filter(
      (id) => !fetchedPosterIdsRef.current.has(id)
    );

    if (missingIds.length === 0) {
      return () => {
        active = false;
      };
    }

    missingIds.forEach((id) => fetchedPosterIdsRef.current.add(id));

    async function fetchPosters() {
      const results = await Promise.all(
        missingIds.map(async (id) => {
          try {
            const response = await fetch(`/api/movies/${id}`);

            if (!response.ok) return [id, null] as const;

            const movie = (await response.json()) as MovieDetails;
            return [id, movie.posterUrl ?? null] as const;
          } catch (error) {
            console.error(`Could not load movie poster ${id}:`, error);
            return [id, null] as const;
          }
        })
      );

      if (!active) return;

      setMoviePosters((current) => {
        const next = { ...current };

        for (const [id, posterUrl] of results) {
          next[id] = posterUrl;
        }

        return next;
      });
    }

    void fetchPosters();

    return () => {
      active = false;
    };
  }, [listings]);

  const cities = useMemo(() => {
    const uniqueCities = new Map<string, string>();

    for (const listing of listings) {
      const location = listing.location?.trim();
      if (!location) continue;

      const key = location.toLocaleLowerCase("en-IN");

      if (!uniqueCities.has(key)) {
        uniqueCities.set(key, location);
      }
    }

    return Array.from(uniqueCities.values()).sort((a, b) =>
      a.localeCompare(b, "en-IN")
    );
  }, [listings]);

  const citySuggestions = useMemo(() => {
    const query = cityInput.trim().toLowerCase();

    if (!query) return cities.slice(0, 6);

    return cities
      .filter((city) => city.toLowerCase().includes(query))
      .slice(0, 6);
  }, [cities, cityInput]);

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    const city = selectedCity.trim().toLowerCase();

    return listings.filter((listing) => {
      const matchesCategory =
        selectedCategory === "All" ||
        listing.category === selectedCategory;

      const matchesCity =
        !city || (listing.location ?? "").toLowerCase().includes(city);

      const searchableText = [
        listing.title,
        listing.category,
        listing.venue ?? "",
        listing.location ?? "",
        listing.description ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesCategory &&
        matchesCity &&
        (!query || searchableText.includes(query))
      );
    });
  }, [listings, selectedCategory, selectedCity, search]);

  function applyCity(city: string) {
    setCityInput(city);
    setSelectedCity(city.trim());
    setShowCitySuggestions(false);
  }

  function clearFilters() {
    setSearch("");
    setSelectedCategory("All");
    setSelectedCity("");
    setCityInput("");
    setShowCitySuggestions(false);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#090a0c] text-[#f5f2eb]">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#090a0c]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-5 py-4 sm:px-8 lg:px-12">
          <Link href="/" className="group flex shrink-0 items-center gap-3">
            <LogoMark />
            <span className="text-xl font-bold tracking-[-0.06em] sm:text-2xl">
              Cine<span className="text-[#d6b36a]">Relay</span>
            </span>
          </Link>

          <nav className="flex items-center gap-3 text-xs sm:gap-6 sm:text-sm">
            <Link
              href="/my-listings"
              className="hidden text-white/75 transition hover:text-[#f0dcae] sm:inline"
            >
              My Listings
            </Link>

            <Link
              href="/profile"
              className="hidden text-white/75 transition hover:text-[#f0dcae] sm:inline"
            >
              Profile
            </Link>

            <MessageNotifications />

            <Link
              href="/auth"
              className="hidden text-white/75 transition hover:text-[#f0dcae] sm:inline"
            >
              Sign in
            </Link>

            <Link
              href="/sell"
              className="inline-flex items-center gap-2 rounded-full bg-[#d6b36a] px-3 py-2.5 font-bold text-[#111111] transition hover:bg-[#f0dcae] sm:px-5"
            >
              + Sell a ticket
            </Link>
          </nav>
        </div>
      </header>

      {/* CINEMATIC HERO */}
      <section className="relative isolate overflow-hidden border-b border-white/[0.06]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
        >
          <div className="absolute left-[40%] top-[-260px] h-[650px] w-[850px] rounded-full bg-[#d6b36a]/[0.10] blur-[140px]" />
          <div className="absolute right-[-180px] top-40 h-80 w-80 rounded-full bg-violet-900/[0.08] blur-[110px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />
        </div>

        <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:px-12 lg:py-24">
          <div className="relative z-10 min-w-0">
            <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-[#d6b36a]/30 bg-[#d6b36a]/[0.07] px-4 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#d6b36a]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.19em] text-[#f0dcae] sm:text-xs">
                Your next experience starts here
              </span>
            </div>

            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.08] tracking-[-0.065em] text-[#fffaf0] sm:text-6xl md:text-7xl xl:text-[76px]">
              Every ticket
              <br />
              deserves a{" "}
              <span className="premium-gold-text italic whitespace-nowrap">
                second act.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-white/70 sm:text-lg">
              Plans change. Great experiences shouldn&apos;t go to waste.
              Discover tickets from other fans and find your next unforgettable
              moment with CineRelay.
            </p>

            {/* SEARCH */}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                applyCity(cityInput);
                document
                  .getElementById("marketplace")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl border border-white/15 bg-[#151619]/95 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl focus-within:border-[#d6b36a]/50 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-5 w-5 shrink-0 text-[#d6b36a]"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <circle cx="10.8" cy="10.8" r="6.8" />
                    <path d="m16 16 4.2 4.2" strokeLinecap="round" />
                  </svg>

                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Movies, events, venues..."
                    aria-label="Search listings"
                    className="w-full min-w-0 bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/55"
                  />
                </div>

                <div className="relative flex min-w-0 items-center gap-2 border-t border-white/10 pt-2 sm:w-48 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-5 w-5 shrink-0 text-[#d6b36a]"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <path
                      d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>

                  <input
                    type="text"
                    value={cityInput}
                    onChange={(event) => {
                      setCityInput(event.target.value);
                      setSelectedCity(event.target.value.trim());
                      setShowCitySuggestions(true);
                    }}
                    onFocus={() => setShowCitySuggestions(true)}
                    onBlur={() => {
                      window.setTimeout(
                        () => setShowCitySuggestions(false),
                        150
                      );
                    }}
                    placeholder="Enter your city"
                    aria-label="Enter city"
                    aria-autocomplete="list"
                    className="w-full min-w-0 bg-transparent py-2 text-sm text-white outline-none placeholder:text-white/55"
                  />

                  {cityInput && (
                    <button
                      type="button"
                      onClick={() => applyCity("")}
                      aria-label="Clear city"
                      className="text-white/60 hover:text-white"
                    >
                      ×
                    </button>
                  )}

                  {showCitySuggestions && citySuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-3 overflow-hidden rounded-xl border border-white/15 bg-[#151619] py-2 shadow-2xl sm:min-w-56">
                      <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/45">
                        Matching locations
                      </p>

                      {citySuggestions.map((city) => (
                        <button
                          key={city}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applyCity(city)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-white/85 transition hover:bg-white/[0.07] hover:text-[#f0dcae]"
                        >
                          <span className="text-[#d6b36a]">⌖</span>
                          {city}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="rounded-xl bg-[#d6b36a] px-7 py-3.5 text-sm font-bold text-[#111111] transition hover:bg-[#f0dcae] active:scale-[0.98]"
              >
                Explore tickets
              </button>
            </form>

            <p className="mt-3 text-xs leading-5 text-white/55">
              Type any city or select a suggested location. No location
              permission required.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/60 sm:text-sm">
              <span>
                <span className="text-[#d6b36a]">✦</span> Approved listings
              </span>
              <span className="h-1 w-1 rounded-full bg-white/30" />
              <span>Connect with sellers</span>
              <span className="h-1 w-1 rounded-full bg-white/30" />
              <span>Discover more</span>
            </div>
          </div>

          {/* DECORATIVE CINEMA CARDS */}
          <div className="relative mx-auto hidden w-full max-w-[450px] lg:block">
            <div className="absolute inset-8 rounded-full bg-[#d6b36a]/10 blur-[85px]" />

            <div className="relative aspect-[0.92]">
              <div className="absolute left-[2%] top-[15%] h-[62%] w-[46%] rotate-[-10deg] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#25232a] via-[#15151a] to-[#0b0c10] shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(214,179,106,0.25),transparent_55%)]" />
                <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center">
                  <span className="text-5xl text-[#d6b36a]/80">✦</span>
                  <span className="mt-5 text-[9px] uppercase tracking-[0.25em] text-white/60">
                    The experience
                  </span>
                  <span className="mt-2 text-xl font-semibold text-white">
                    Awaits.
                  </span>
                </div>
              </div>

              <div className="absolute right-[3%] top-[5%] h-[70%] w-[54%] rotate-[7deg] overflow-hidden rounded-2xl border border-[#d6b36a]/30 bg-gradient-to-br from-[#31291d] via-[#171511] to-[#0c0c0e] shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_55%_25%,rgba(240,220,174,0.23),transparent_50%),linear-gradient(155deg,transparent_35%,rgba(0,0,0,0.8))]" />
                <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#d6b36a]/35 bg-black/30 text-2xl text-[#e5ca91]">
                    ▶
                  </div>
                  <span className="mt-6 text-[9px] uppercase tracking-[0.25em] text-[#f0dcae]">
                    Your seat is waiting
                  </span>
                  <span className="mt-3 text-2xl font-semibold leading-tight text-white">
                    Make it
                    <br />
                    memorable.
                  </span>
                </div>
              </div>

              <div className="absolute bottom-[5%] left-[12%] right-[1%] rounded-2xl border border-white/15 bg-[#141519] p-5 shadow-2xl">
                <p className="text-[9px] uppercase tracking-[0.2em] text-white/60">
                  A better way to discover
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  Your next big moment.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-16 lg:px-12">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d6b36a]">
              Explore your interests
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-[#fffaf0] sm:text-3xl">
              Find your kind of experience
            </h2>
          </div>

          <p className="text-sm text-white/60">
            One marketplace. More possibilities.
          </p>
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
              aria-pressed={selectedCategory === category}
              className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition duration-300 hover:-translate-y-1 sm:p-6 ${
                selectedCategory === category
                  ? "border-[#d6b36a]/50 bg-[#d6b36a]/[0.08]"
                  : "border-white/[0.10] bg-white/[0.035] hover:border-[#d6b36a]/30 hover:bg-white/[0.06]"
              }`}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.10] bg-black/30 transition group-hover:scale-110"
                style={{ color: categoryColors[category] ?? "#d6b36a" }}
              >
                <CategoryIcon category={category} className="h-6 w-6" />
              </span>

              <span className="mt-5 block font-semibold text-[#fffaf0]">
                {category}
              </span>

              <span className="mt-1.5 flex items-center justify-between text-xs text-white/60">
                Discover listings
                <span className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* MARKETPLACE */}
      <section
        id="marketplace"
        className="mx-auto max-w-[1440px] scroll-mt-24 px-5 pb-20 pt-8 sm:px-8 lg:px-12"
      >
        <div className="mb-8 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-[#d6b36a]" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d6b36a]">
                The marketplace
              </p>
            </div>

            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.055em] text-[#fffaf0] sm:text-4xl">
              Tickets worth discovering
              <span className="text-[#d6b36a]">.</span>
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-7 text-white/65">
              Explore approved listings from other fans and find an experience
              that fits your plans.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                aria-pressed={selectedCategory === category}
                className={`rounded-full border px-4 py-2 text-xs font-medium transition sm:text-sm ${
                  selectedCategory === category
                    ? "border-[#d6b36a] bg-[#d6b36a] text-[#111111]"
                    : "border-white/10 bg-white/[0.035] text-white/75 hover:border-[#d6b36a]/40 hover:text-white"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {(selectedCity || search.trim()) && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/60">Active filters:</span>

            {selectedCity && (
              <span className="rounded-full border border-[#d6b36a]/25 bg-[#d6b36a]/[0.08] px-3 py-1.5 text-xs text-[#f0dcae]">
                📍 {selectedCity}
              </span>
            )}

            {search.trim() && (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/80">
                Search: {search.trim()}
              </span>
            )}

            <button
              type="button"
              onClick={clearFilters}
              className="ml-1 text-xs text-white/65 underline underline-offset-4 hover:text-[#f0dcae]"
            >
              Clear all
            </button>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="rounded-2xl border border-red-400/25 bg-red-400/[0.08] p-6 text-red-100"
          >
            <p>{errorMessage}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setReloadKey((key) => key + 1);
              }}
              className="mt-3 text-sm font-semibold underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035]"
              >
                <div className="aspect-[3/4] animate-pulse bg-white/[0.07]" />
                <div className="space-y-4 p-5">
                  <div className="h-3 w-1/3 animate-pulse rounded bg-white/[0.09]" />
                  <div className="h-5 w-3/4 animate-pulse rounded bg-white/[0.09]" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-white/[0.09]" />
                  <div className="h-10 animate-pulse rounded-xl bg-white/[0.09]" />
                </div>
              </div>
            ))}
          </div>
        ) : !errorMessage && filteredListings.length === 0 ? (
          <div className="relative overflow-hidden rounded-3xl border border-dashed border-white/[0.16] bg-white/[0.025] px-6 py-20 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#d6b36a]/25 bg-[#d6b36a]/[0.08] text-3xl">
              <CategoryIcon category="Movies" className="h-7 w-7 text-[#d6b36a]" />
            </div>

            <h3 className="mt-6 text-2xl font-semibold text-[#fffaf0]">
              No tickets found
            </h3>

            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-white/65">
              {selectedCity
                ? `No matching listings were found for "${selectedCity}". Try another city or clear your filters.`
                : search || selectedCategory !== "All"
                  ? "Try another search or category to discover available listings."
                  : "There are no approved listings yet. Be among the first to share a ticket."}
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full border border-white/20 px-5 py-3 text-sm font-medium text-white transition hover:border-[#d6b36a]/50"
              >
                Clear filters
              </button>

              <Link
                href="/sell"
                className="rounded-full bg-[#d6b36a] px-5 py-3 text-sm font-bold text-[#111111] transition hover:bg-[#f0dcae]"
              >
                List a ticket →
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between text-xs text-white/60">
              <p>
                Showing{" "}
                <span className="font-semibold text-white">
                  {filteredListings.length}
                </span>{" "}
                {filteredListings.length === 1 ? "listing" : "listings"}
              </p>
              <span className="hidden sm:inline">Sorted by newest first</span>
            </div>

            <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredListings.map((listing) => {
                const posterUrl =
                  listing.category === "Movies" && listing.tmdb_movie_id
                    ? moviePosters[Number(listing.tmdb_movie_id)] ?? null
                    : null;

                const isMovie = listing.category === "Movies";

                return (
                  <article
                    key={listing.id}
                    className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#101114] transition duration-500 ease-out hover:-translate-y-1.5 hover:border-[#d6b36a]/35 hover:shadow-[0_22px_65px_rgba(0,0,0,0.3)]"
                  >
                    <Link
                      href={`/listing/${listing.id}`}
                      aria-label={`View ${listing.title} ticket details`}
                      className={`relative block overflow-hidden ${
                        isMovie ? "aspect-[3/4]" : "aspect-[3/2]"
                      } bg-[#15161a]`}
                    >
                      {isMovie ? (
                        posterUrl ? (
                          <img
                            src={posterUrl}
                            alt={`${listing.title} movie poster`}
                            loading="lazy"
                            className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.045]"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#1a1a20] to-[#0b0c0e] p-6 text-center">
                            <CategoryIcon
                              category="Movies"
                              className="h-12 w-12 text-[#d6b36a]/80"
                            />
                            <span className="mt-4 text-xs text-white/60">
                              Movie artwork
                            </span>
                          </div>
                        )
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#202027] to-[#0b0c0e]">
                          <span
                            style={{
                              color:
                                categoryColors[listing.category] ?? "#d6b36a",
                            }}
                          >
                            <CategoryIcon
                              category={listing.category}
                              className="h-12 w-12"
                            />
                          </span>
                          <span className="mt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/65">
                            {listing.category}
                          </span>
                        </div>
                      )}

                      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
                        <span className="rounded-full border border-white/15 bg-black/65 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white backdrop-blur-md">
                          {listing.category}
                        </span>
                        <span className="rounded-full border border-emerald-300/25 bg-black/65 px-2.5 py-1.5 text-[10px] font-medium text-emerald-200 backdrop-blur-md">
                          Available
                        </span>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#101114] via-[#101114]/30 to-transparent" />
                    </Link>

                    <div className="flex flex-1 flex-col px-5 pb-5">
                      <Link
                        href={`/listing/${listing.id}`}
                        className="line-clamp-2 text-lg font-semibold leading-snug tracking-[-0.035em] text-[#fffaf0] transition-colors hover:text-[#e5ca91]"
                      >
                        {listing.title}
                      </Link>

                      <div className="mt-3 space-y-2">
                        {listing.venue && (
                          <p className="flex items-start gap-2 text-xs leading-5 text-white/75">
                            <span className="shrink-0 text-[#d6b36a]">⌖</span>
                            <span className="line-clamp-2">{listing.venue}</span>
                          </p>
                        )}

                        {listing.location && (
                          <p className="flex items-start gap-2 text-xs leading-5 text-white/65">
                            <span className="shrink-0 text-[#d6b36a]">◎</span>
                            <span className="line-clamp-1">{listing.location}</span>
                          </p>
                        )}

                        {(listing.event_date || listing.event_time) && (
                          <p className="flex items-center gap-2 text-xs text-white/65">
                            <span className="text-[#d6b36a]">◷</span>
                            {[
                              listing.event_date
                                ? formatDate(listing.event_date)
                                : null,
                              listing.event_time,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </div>

                      {listing.description && (
                        <p className="mt-4 line-clamp-2 text-xs leading-6 text-white/65">
                          {listing.description}
                        </p>
                      )}

                      <div className="mt-auto pt-6">
                        <div className="mb-4 flex items-end justify-between gap-2 border-t border-white/[0.09] pt-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.15em] text-white/60">
                              Asking price
                            </p>
                            <p className="mt-1 text-xl font-semibold tracking-tight text-[#f0dcae]">
                              {formatPrice(Number(listing.price))}
                            </p>
                          </div>
                          <span className="pb-1 text-[10px] text-white/55">
                            INR
                          </span>
                        </div>

                        <Link
                          href={`/listing/${listing.id}`}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.045] px-4 py-3 text-sm font-semibold text-white transition duration-300 hover:border-[#d6b36a]/40 hover:bg-[#d6b36a] hover:text-[#111111]"
                        >
                          View details
                          <span className="transition-transform group-hover:translate-x-1">
                            →
                          </span>
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* HOW IT WORKS */}
      <section className="border-y border-white/[0.07] bg-[#0e0f11]">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#d6b36a]">
              Simple by design
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#fffaf0] sm:text-4xl">
              Three steps. One great experience.
            </h2>

            <p className="mt-4 text-sm leading-7 text-white/65 sm:text-base">
              CineRelay helps ticket holders and interested buyers find each
              other when plans change.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                number: "01",
                title: "Discover",
                description:
                  "Browse available tickets and explore experiences that match your plans.",
              },
              {
                number: "02",
                title: "Connect",
                description:
                  "Open a listing, review the details, and contact the seller through CineRelay.",
              },
              {
                number: "03",
                title: "Relay",
                description:
                  "Follow the platform's available purchase process and help an unused ticket find a new owner.",
              },
            ].map((step) => (
              <div
                key={step.number}
                className="group rounded-2xl border border-white/[0.09] bg-white/[0.025] p-7 transition duration-300 hover:border-[#d6b36a]/30 hover:bg-white/[0.04] sm:p-8"
              >
                <span className="text-sm font-semibold tracking-[0.2em] text-[#d6b36a]">
                  {step.number}
                </span>

                <h3 className="mt-6 text-xl font-semibold text-[#fffaf0]">
                  {step.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-white/65">
                  {step.description}
                </p>

                <div className="mt-7 h-px w-10 bg-[#d6b36a]/60 transition-all duration-300 group-hover:w-20" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SELLER CTA */}
      <section className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
        <div className="relative isolate overflow-hidden rounded-3xl border border-[#d6b36a]/25 bg-[#151518] px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_90%_15%,rgba(214,179,106,0.13),transparent_55%)]"
          />

          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#f0dcae]">
                Pass on the experience
              </p>

              <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.045em] text-[#fffaf0] sm:text-4xl lg:text-5xl">
                Plans changed?
                <br />
                <span className="premium-gold-text">
                  Your ticket still matters.
                </span>
              </h2>

              <p className="mt-4 max-w-xl text-sm leading-7 text-white/70">
                List your unused ticket, submit it for review, and connect
                with interested buyers once your listing is approved.
              </p>
            </div>

            <Link
              href="/sell"
              className="group inline-flex shrink-0 items-center gap-3 rounded-full bg-[#d6b36a] px-7 py-4 text-sm font-bold text-[#111111] transition duration-300 hover:bg-[#f0dcae]"
            >
              List your ticket
              <span className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* PREMIUM FOOTER */}
      <footer className="border-t border-white/[0.08] bg-black/30">
        <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div>
              <Link href="/" className="inline-flex items-center gap-3">
                <LogoMark small />
                <span className="text-lg font-bold tracking-[-0.05em] text-white">
                  Cine<span className="text-[#d6b36a]">Relay</span>
                </span>
              </Link>

              <p className="mt-4 max-w-xs text-sm leading-7 text-white/60">
                Discover new experiences. Connect with ticket holders. Give
                unused tickets another chance.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0dcae]">
                Explore
              </h3>
              <div className="mt-4 flex flex-col gap-3 text-sm text-white/65">
                <Link href="/#marketplace" className="hover:text-white">
                  Browse tickets
                </Link>
                <Link href="/sell" className="hover:text-white">
                  Sell a ticket
                </Link>
                <Link href="/my-listings" className="hover:text-white">
                  My listings
                </Link>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0dcae]">
                Your account
              </h3>
              <div className="mt-4 flex flex-col gap-3 text-sm text-white/65">
                <Link href="/profile" className="hover:text-white">
                  My profile
                </Link>
                <Link href="/messages" className="hover:text-white">
                  Messages
                </Link>
                <Link href="/auth" className="hover:text-white">
                  Sign in / Sign up
                </Link>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0dcae]">
                CineRelay
              </h3>
              <div className="mt-4 flex flex-col gap-3 text-sm text-white/65">
                <a href="mailto:support@cinerelay.com" className="hover:text-white">
                  Contact support
                </a>
                <Link href="/terms" className="hover:text-white">
                  Terms
                </Link>
                <Link href="/privacy" className="hover:text-white">
                  Privacy
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-white/[0.08] pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} CineRelay. All rights reserved.
            </p>
            <p>Discover. Connect. Relay.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
