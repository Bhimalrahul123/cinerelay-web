
import { NextRequest, NextResponse } from "next/server";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

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

    const token = process.env.TMDB_READ_ACCESS_TOKEN;

    if (!token) {
      console.error("TMDB_READ_ACCESS_TOKEN is missing.");
      return NextResponse.json(
        { error: "Movie service is not configured." },
        { status: 500 }
      );
    }

    const url = new URL(`${TMDB_BASE_URL}/movie/${id}`);
    url.searchParams.set("language", "en-US");
    url.searchParams.set("append_to_response", "videos,credits");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
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
              : "Unable to retrieve movie details.",
        },
        { status: response.status === 404 ? 404 : 502 }
      );
    }

    const movie = await response.json();

    const trailer = (movie.videos?.results ?? []).find(
      (video: {
        site: string;
        type: string;
        key: string;
        official?: boolean;
      }) =>
        video.site === "YouTube" &&
        video.type === "Trailer" &&
        Boolean(video.key)
    );

    const cast = (movie.credits?.cast ?? [])
      .slice(0, 12)
      .map(
        (actor: {
          id: number;
          name: string;
          character: string;
          profile_path: string | null;
        }) => ({
          id: actor.id,
          name: actor.name,
          character: actor.character,
          profileUrl: actor.profile_path
            ? `${IMAGE_BASE_URL}/w185${actor.profile_path}`
            : null,
        })
      );

    return NextResponse.json({
      id: movie.id,
      title: movie.title,
      overview: movie.overview ?? "",
      posterUrl: movie.poster_path
        ? `${IMAGE_BASE_URL}/w500${movie.poster_path}`
        : null,
      backdropUrl: movie.backdrop_path
        ? `${IMAGE_BASE_URL}/w1280${movie.backdrop_path}`
        : null,
      releaseDate: movie.release_date ?? "",
      rating: movie.vote_average ?? 0,
      runtime: movie.runtime ?? null,
      trailerUrl: trailer
        ? `https://www.youtube.com/watch?v=${trailer.key}`
        : null,
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
