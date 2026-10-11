import { NextRequest, NextResponse } from "next/server";
import { applyTmdbAuth, getTmdbAuth } from "@/lib/env";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

interface VideoItem {
  site?: string;
  type?: string;
  key?: string;
  official?: boolean;
}

function resolveYouTubeTrailer(videos: VideoItem[]): string | null {
  const ytVideos = (videos ?? []).filter(
    (v) =>
      v.site === "YouTube" &&
      typeof v.key === "string" &&
      /^[a-zA-Z0-9_-]{11}$/.test(v.key)
  );

  if (ytVideos.length === 0) return null;

  function score(v: VideoItem): number {
    let s = 0;
    if (v.type === "Trailer") s += 100;
    else if (v.type === "Teaser") s += 50;
    else if (v.type === "Clip") s += 25;
    if (v.official) s += 10;
    return s;
  }

  const sorted = [...ytVideos].sort((a, b) => score(b) - score(a));
  return `https://www.youtube.com/watch?v=${sorted[0].key}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!/^\d+$/.test(id) || Number(id) <= 0) {
      return NextResponse.json(
        { error: "Invalid movie ID." },
        { status: 400 }
      );
    }

    const auth = getTmdbAuth();
    if (!auth) {
      console.warn("TMDB credentials are not configured in environment variables.");
      return NextResponse.json(
        {
          error:
            "Movie service credentials are not configured on the server. Please set TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY.",
          configured: false,
        },
        { status: 503 }
      );
    }

    const url = new URL(`${TMDB_BASE_URL}/movie/${id}`);
    url.searchParams.set("language", "en-US");
    url.searchParams.set("append_to_response", "videos,credits");

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    applyTmdbAuth(url, headers);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error("TMDB movie details status:", response.status);

      return NextResponse.json(
        {
          error:
            response.status === 404
              ? "Movie not found."
              : `Unable to retrieve movie details from TMDB (status ${response.status}).`,
        },
        { status: response.status === 404 ? 404 : 502 }
      );
    }

    const movie = await response.json();

    const trailerUrl = resolveYouTubeTrailer(movie.videos?.results ?? []);

    const cast = (movie.credits?.cast ?? [])
      .slice(0, 12)
      .map(
        (actor: {
          id: number;
          name: string;
          character?: string;
          profile_path?: string | null;
        }) => ({
          id: actor.id,
          name: actor.name,
          character: actor.character ?? "",
          profileUrl: actor.profile_path
            ? `${IMAGE_BASE_URL}/w185${actor.profile_path}`
            : null,
        })
      );

    const genres: string[] = (movie.genres ?? [])
      .map((g: { id?: number; name?: string } | string) =>
        typeof g === "string" ? g : g.name ?? ""
      )
      .filter((name: string) => Boolean(name && name.trim()));

    return NextResponse.json({
      id: movie.id,
      title: movie.title ?? "",
      overview: movie.overview ?? "",
      posterUrl: movie.poster_path
        ? `${IMAGE_BASE_URL}/w500${movie.poster_path}`
        : null,
      backdropUrl: movie.backdrop_path
        ? `${IMAGE_BASE_URL}/w1280${movie.backdrop_path}`
        : null,
      releaseDate: movie.release_date ?? "",
      rating: typeof movie.vote_average === "number" ? movie.vote_average : 0,
      runtime: typeof movie.runtime === "number" ? movie.runtime : null,
      trailerUrl,
      genres,
      cast,
    });
  } catch (error) {
    console.error("CineRelay movie details error:", error);

    return NextResponse.json(
      { error: "Unable to retrieve movie details. Please try again." },
      { status: 502 }
    );
  }
}
