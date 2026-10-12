
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isTicketExpired } from "@/lib/expiration";

type Listing = {
  id: string;
  category: string;
  title: string;
  venue: string | null;
  location: string | null;
  price: number;
  description: string | null;
  event_date: string | null;
  event_time: string | null;
  screen_number: string | null;
  seat_category: string | null;
  seat_numbers: string | null;
  cancellation_reason: string | null;
  tmdb_movie_id: number | null;
  created_at: string;
};

type CastMember = {
  id: number;
  name: string;
  character: string;
  profileUrl: string | null;
};

type MovieDetails = {
  id: number;
  title: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string;
  rating: number;
  runtime: number | null;
  trailerUrl: string | null;
  cast: CastMember[];
  genres?: Array<string | { id?: number; name: string }>;
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

function formatDate(value: string | null) {
  if (!value) return null;

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
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

function getYouTubeEmbedUrl(url: string | null | undefined) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    let videoId = "";

    if (parsed.hostname === "youtu.be") {
      videoId = parsed.pathname.slice(1);
    } else if (
      parsed.hostname.endsWith("youtube.com") ||
      parsed.hostname.endsWith("youtube-nocookie.com")
    ) {
      if (parsed.pathname === "/watch") {
        videoId = parsed.searchParams.get("v") ?? "";
      } else if (
        parsed.pathname.startsWith("/embed/") ||
        parsed.pathname.startsWith("/shorts/")
      ) {
        videoId = parsed.pathname.split("/")[2] ?? "";
      }
    }

    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;

    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  } catch {
    return null;
  }
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 transition hover:border-[#d6b36a]/25">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-medium leading-6 text-white/85">
        {value}
      </p>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d6b36a]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-[#fffaf0] sm:text-3xl">
        {title}
        <span className="text-[#d6b36a]">.</span>
      </h2>
      {description && (
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/50">
          {description}
        </p>
      )}
    </div>
  );
}

export default function ListingDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [listing, setListing] = useState<Listing | null>(null);
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [movieLoading, setMovieLoading] = useState(false);
  const [error, setError] = useState("");
  const [movieError, setMovieError] = useState("");
  const [startingChat, setStartingChat] = useState(false);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadListing() {
      try {
        setLoading(true);
        setError("");

        const { data, error: fetchError } = await supabase
          .from("listings")
          .select(
            "id, category, title, venue, location, price, description, event_date, event_time, screen_number, seat_category, seat_numbers, cancellation_reason, tmdb_movie_id, created_at"
          )
          .eq("id", id)
          .eq("status", "approved")
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (active) {
          const loadedListing = (data as Listing | null) ?? null;
          setListing(loadedListing);

          // If event show date/time has passed, trigger automatic status update
          if (loadedListing && isTicketExpired(loadedListing.event_date, loadedListing.event_time)) {
            void supabase
              .from("listings")
              .update({ status: "expired" })
              .eq("id", id)
              .then(() => {});
          }
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load this listing."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    if (id) void loadListing();

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;

    async function loadMovie() {
      if (
        !listing ||
        listing.category !== "Movies" ||
        !listing.tmdb_movie_id
      ) {
        setMovie(null);
        setMovieError("");
        setMovieLoading(false);
        return;
      }

      try {
        setMovieLoading(true);
        setMovieError("");
        setMovie(null);

        const response = await fetch(
          `/api/movies/${listing.tmdb_movie_id}`,
          { cache: "no-store" }
        );

        const data: MovieDetails & { error?: string } =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || `Movie API returned ${response.status}.`
          );
        }

        if (active) {
          setMovie({
            id: data.id,
            title: data.title,
            overview: data.overview,
            posterUrl: data.posterUrl ?? null,
            backdropUrl: data.backdropUrl ?? null,
            releaseDate: data.releaseDate ?? "",
            rating: Number(data.rating ?? 0),
            runtime: data.runtime ?? null,
            trailerUrl: data.trailerUrl ?? null,
            cast: Array.isArray(data.cast) ? data.cast : [],
            genres: Array.isArray(data.genres) ? data.genres : [],
          });
        }
      } catch (err) {
        if (active) {
          setMovieError(
            err instanceof Error
              ? err.message
              : "Unable to load movie details."
          );
        }
      } finally {
        if (active) setMovieLoading(false);
      }
    }

    void loadMovie();

    return () => {
      active = false;
    };
  }, [listing]);

  async function handleChatWithSeller() {
    if (!listing || startingChat) return;

    setStartingChat(true);
    setChatError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        router.push(
          `/auth?mode=login&next=${encodeURIComponent(
            `/listing/${listing.id}`
          )}`
        );
        return;
      }

      const { data, error: rpcError } = await supabase.rpc(
        "open_listing_chat",
        {
          p_listing_id: listing.id,
        }
      );

      if (rpcError) throw rpcError;

      if (!data || typeof data !== "string") {
        throw new Error("Could not open the conversation.");
      }

      router.push(`/messages/${data}`);
    } catch (err) {
      setChatError(
        err instanceof Error
          ? err.message
          : "Unable to start the conversation."
      );
      setStartingChat(false);
    }
  }

  const isMovie = listing?.category === "Movies";
  const isExpired = listing
    ? isTicketExpired(listing.event_date, listing.event_time)
    : false;
  const trailerEmbed = getYouTubeEmbedUrl(movie?.trailerUrl);

  const genres =
    movie?.genres?.map((genre) =>
      typeof genre === "string" ? genre : genre.name
    ) ?? [];

  return (
    <main className="min-h-screen bg-[#090a0c] text-[#f5f2eb]">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#090a0c]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d6b36a]/30 bg-[#d6b36a]/[0.08] text-xl text-[#e5ca91]">
              ◈
            </span>
            <span className="text-lg font-semibold tracking-[-0.04em] sm:text-xl">
              Cine<span className="font-light text-[#d6b36a]">Relay</span>
            </span>
          </Link>

          <nav className="flex items-center gap-3 text-xs text-white/60 sm:gap-6 sm:text-sm">
            <Link href="/" className="transition hover:text-[#e5ca91]">
              Explore
            </Link>
            <Link
              href="/messages"
              className="transition hover:text-[#e5ca91]"
            >
              Messages
            </Link>
            <Link
              href="/my-listings"
              className="hidden transition hover:text-[#e5ca91] sm:inline"
            >
              My listings
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-7 sm:px-6 sm:pt-10 lg:px-8">
        <div className="mb-7 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-[#e5ca91]"
          >
            <span aria-hidden="true">←</span>
            Back to marketplace
          </Link>
          <span className="hidden text-[10px] uppercase tracking-[0.22em] text-white/30 sm:block">
            A better way to pass it on
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-white/[0.08] bg-white/[0.025] p-8 text-center">
            <div
              className="mb-5 h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-[#d6b36a]"
              aria-label="Loading"
            />
            <p className="text-sm text-white/55">
              Preparing your listing...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-7 sm:p-10">
            <p className="text-xs uppercase tracking-[0.2em] text-red-200/70">
              Something went wrong
            </p>
            <h1 className="mt-3 text-2xl font-semibold">
              We couldn&apos;t load this listing.
            </h1>
            <p className="mt-3 break-words text-sm leading-6 text-red-100/70">
              {error}
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex text-sm text-[#e5ca91] hover:text-white"
            >
              Return to explore →
            </Link>
          </div>
        ) : !listing ? (
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] px-6 py-16 text-center sm:px-12">
            <span className="text-4xl text-[#d6b36a]">◈</span>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">
              This listing is no longer available
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/50">
              It may have been removed or is no longer approved. Explore
              other listings to find your next experience.
            </p>
            <Link href="/" className="premium-button mt-7">
              Explore listings
            </Link>
          </div>
        ) : (
          <>
            {isMovie && (
              <section className="relative mb-7 overflow-hidden rounded-3xl border border-white/[0.09] bg-[#101114]">
                {movie?.backdropUrl && (
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-25"
                    style={{
                      backgroundImage: `url("${movie.backdropUrl}")`,
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-[#090a0c] via-[#090a0c]/90 to-[#090a0c]/50" />
                <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#d6b36a]/10 blur-3xl" />

                <div className="relative grid gap-7 p-6 sm:p-9 md:grid-cols-[150px_minmax(0,1fr)] md:items-center lg:gap-10 lg:p-12">
                  <div className="mx-auto w-32 sm:w-36 md:w-full">
                    {movie?.posterUrl ? (
                      <img
                        src={movie.posterUrl}
                        alt={`${movie.title} poster`}
                        className="w-full rounded-xl border border-white/15 object-cover shadow-2xl shadow-black/50"
                      />
                    ) : (
                      <div className="flex aspect-[2/3] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-4xl text-[#e5ca91]">
                        ◈
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 text-center md:text-left">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#d6b36a]">
                      CineRelay selection
                    </p>
                    <h1 className="mt-4 text-3xl font-semibold tracking-[-0.045em] text-[#fffaf0] sm:text-4xl lg:text-5xl">
                      {movie?.title || listing.title}
                    </h1>

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-white/55 md:justify-start">
                      {movie?.releaseDate && (
                        <span>{movie.releaseDate.slice(0, 4)}</span>
                      )}
                      {movie?.runtime ? (
                        <>
                          <span className="text-white/20">/</span>
                          <span>{movie.runtime} min</span>
                        </>
                      ) : null}
                      {movie && movie.rating > 0 && (
                        <>
                          <span className="text-white/20">/</span>
                          <span className="text-[#e5ca91]">
                            ★ {movie.rating.toFixed(1)}{" "}
                            <span className="text-white/40">TMDB</span>
                          </span>
                        </>
                      )}
                    </div>

                    {genres.length > 0 && (
                      <div className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start">
                        {genres.map((genre) => (
                          <span
                            key={genre}
                            className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/65"
                          >
                            {genre}
                          </span>
                        ))}
                      </div>
                    )}

                    {movieLoading && (
                      <p className="mt-4 text-xs text-white/45">
                        Loading movie information...
                      </p>
                    )}
                    {movieError && (
                      <p className="mt-4 text-xs text-amber-200/80">
                        {movieError}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {isMovie && (
              <section className="premium-glass mb-7 rounded-3xl p-5 sm:p-7 lg:p-9">
                <SectionHeading
                  eyebrow="01 / Watch first"
                  title="The official trailer"
                  description="A little preview before you make your plans."
                />
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
                  {trailerEmbed ? (
                    <iframe
                      src={trailerEmbed}
                      title={`${movie?.title || listing.title} trailer`}
                      className="aspect-video w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  ) : (
                    <div className="flex aspect-video max-h-[440px] flex-col items-center justify-center p-8 text-center">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[#d6b36a]/35 bg-[#d6b36a]/10 text-xl text-[#e5ca91]">
                        ▶
                      </span>
                      <p className="mt-5 text-sm text-white/75">
                        {movieLoading
                          ? "Finding the trailer..."
                          : "Trailer unavailable"}
                      </p>
                      <p className="mt-2 max-w-sm text-xs leading-5 text-white/40">
                        {movieError ||
                          "There isn't an embeddable YouTube trailer available for this title."}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className="mb-7 overflow-hidden rounded-3xl border border-white/[0.09] bg-[#101114]">
              <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="p-6 sm:p-8 lg:p-10">
                  <SectionHeading
                    eyebrow={isMovie ? "02 / Find your seats" : "Available listing"}
                    title="Ticket details"
                    description="Review the listing information carefully before making arrangements."
                  />

                  {isExpired && (
                    <div
                      role="alert"
                      className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4 text-sm text-amber-200"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-300">
                        !
                      </span>
                      <div>
                        <p className="font-semibold text-amber-300">
                          This event has ended / expired
                        </p>
                        <p className="mt-1 text-xs leading-5 text-amber-200/80">
                          The show date and time for this ticket have already passed. This listing is closed and cannot be purchased.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className="inline-flex rounded-full border border-[#d6b36a]/25 bg-[#d6b36a]/[0.06] px-3 py-1.5 text-[11px] font-medium text-[#e5ca91]">
                        {listing.category}
                      </span>
                      <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-[#fffaf0] sm:text-3xl">
                        {listing.title}
                      </h2>
                    </div>

                    {!isMovie && (
                      <span className="text-3xl text-[#d6b36a]">
                        {categoryIcons[listing.category] ?? "◈"}
                      </span>
                    )}
                  </div>

                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    {listing.venue && (
                      <InfoCard
                        label={isMovie ? "Cinema" : "Venue"}
                        value={listing.venue}
                      />
                    )}
                    {listing.location && (
                      <InfoCard label="Location" value={listing.location} />
                    )}
                    {listing.event_date && (
                      <InfoCard
                        label={isMovie ? "Show date" : "Date"}
                        value={
                          formatDate(listing.event_date) ??
                          listing.event_date
                        }
                      />
                    )}
                    {listing.event_time && (
                      <InfoCard
                        label={isMovie ? "Show time" : "Time"}
                        value={
                          formatTime(listing.event_time) ??
                          listing.event_time
                        }
                      />
                    )}
                    {isMovie && listing.screen_number && (
                      <InfoCard label="Screen" value={listing.screen_number} />
                    )}
                    {isMovie && listing.seat_category && (
                      <InfoCard
                        label="Seat category"
                        value={listing.seat_category}
                      />
                    )}
                    {isMovie && listing.seat_numbers && (
                      <InfoCard
                        label="Seat numbers"
                        value={listing.seat_numbers}
                      />
                    )}
                    {isMovie && listing.cancellation_reason && (
                      <InfoCard
                        label="Reason for selling"
                        value={listing.cancellation_reason}
                      />
                    )}
                  </div>

                  {listing.description && (
                    <div className="mt-7 border-t border-white/[0.08] pt-6">
                      <h3 className="text-sm font-semibold text-white/85">
                        About this listing
                      </h3>
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-white/55">
                        {listing.description}
                      </p>
                    </div>
                  )}
                </div>

                <aside className="flex flex-col justify-between border-t border-white/[0.08] bg-white/[0.025] p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-7">
                  <div>
                    <p className="text-xs text-white/45">
                      Seller asking price
                    </p>
                    <p className="mt-2 break-words text-4xl font-semibold tracking-[-0.05em] text-[#e5ca91]">
                      {formatPrice(Number(listing.price))}
                    </p>
                    <p className="mt-3 text-xs leading-5 text-white/40">
                      Confirm ticket transfer eligibility and all event details
                      before paying.
                    </p>
                  </div>

                  <div className="mt-7 space-y-3">
                    {chatError && (
                      <p
                        role="alert"
                        className="break-words rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-xs leading-5 text-red-200"
                      >
                        {chatError}
                      </p>
                    )}

                    {isExpired ? (
                      <div className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 py-3.5 text-sm font-semibold text-amber-200/90 shadow-sm">
                        <span>Event Expired (Show Ended)</span>
                      </div>
                    ) : (
                      <Link
                        href={`/checkout/${listing.id}`}
                        className="premium-button flex w-full items-center justify-center gap-2 py-3.5 text-sm"
                      >
                        Continue to checkout <span>↗</span>
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleChatWithSeller()}
                      disabled={startingChat}
                      className="premium-button-secondary w-full py-3.5 text-sm disabled:cursor-wait disabled:opacity-60"
                    >
                      {startingChat
                        ? "Opening conversation..."
                        : "Message seller"}
                    </button>

                    <p className="pt-1 text-center text-[10px] leading-5 text-white/35">
                      Never share passwords or OTPs. Confirm ticket transfer
                      eligibility before paying.
                    </p>
                  </div>
                </aside>
              </div>
            </section>

            {isMovie && (
              <section className="premium-glass mb-7 rounded-3xl p-6 sm:p-8 lg:p-10">
                <SectionHeading
                  eyebrow="03 / The story"
                  title="A little about the film"
                />
                <p className="max-w-4xl whitespace-pre-line text-sm leading-8 text-white/65 sm:text-base">
                  {movie?.overview ||
                    (movieLoading
                      ? "Loading the movie synopsis..."
                      : "The synopsis is currently unavailable.")}
                </p>
                {movie?.releaseDate && (
                  <p className="mt-5 text-xs text-white/35">
                    Release date · {formatDate(movie.releaseDate)}
                  </p>
                )}
              </section>
            )}

            {isMovie && (
              <section className="premium-glass rounded-3xl p-6 sm:p-8 lg:p-10">
                <SectionHeading
                  eyebrow="04 / The people"
                  title="Cast & crew"
                  description="Meet the faces behind the film."
                />

                {movie?.cast && movie.cast.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {movie.cast.map((person) => (
                      <a
                        key={person.id}
                        href={
                          person.profileUrl ||
                          `https://www.themoviedb.org/person/${person.id}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] transition duration-300 hover:-translate-y-1 hover:border-[#d6b36a]/35 hover:bg-white/[0.045]"
                      >
                        {person.profileUrl ? (
                          <img
                            src={person.profileUrl}
                            alt={person.name}
                            loading="lazy"
                            className="aspect-[3/4] w-full object-cover object-top transition duration-500 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex aspect-[3/4] items-center justify-center bg-white/[0.035] text-3xl text-white/20">
                            ◯
                          </div>
                        )}

                        <div className="p-3">
                          <p className="line-clamp-2 text-sm font-medium text-white/90">
                            {person.name}
                          </p>
                          {person.character && (
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/40">
                              {person.character}
                            </p>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 text-sm text-white/45">
                    {movieLoading
                      ? "Loading cast information..."
                      : "Cast information is currently unavailable."}
                  </p>
                )}

                <p className="mt-6 text-[10px] leading-5 text-white/30">
                  Movie information and cast data provided by TMDB.
                </p>
              </section>
            )}
          </>
        )}
      </div>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-7 text-xs text-white/35 sm:px-6 lg:px-8">
          <Link href="/" className="font-semibold tracking-tight text-white/75">
            Cine<span className="font-light text-[#d6b36a]">Relay</span>
          </Link>
          <p>© 2026 CineRelay · Pass the experience on.</p>
          <Link
            href="/messages"
            className="transition hover:text-[#e5ca91]"
          >
            Messages ↗
          </Link>
        </div>
      </footer>
    </main>
  );
}
