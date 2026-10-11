import { NextRequest, NextResponse } from "next/server";
import { searchMovies } from "@/lib/tmdb";
import { getTmdbAuth } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim();
  const pageValue = request.nextUrl.searchParams.get("page") ?? "1";
  const page = Number(pageValue);

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Enter at least two characters to search." },
      { status: 400 }
    );
  }

  if (query.length > 100) {
    return NextResponse.json(
      { error: "Search query is too long." },
      { status: 400 }
    );
  }

  if (!Number.isInteger(page) || page < 1 || page > 500) {
    return NextResponse.json(
      { error: "Invalid page number." },
      { status: 400 }
    );
  }

  const auth = getTmdbAuth();
  if (!auth) {
    return NextResponse.json(
      {
        error:
          "Movie search service is not configured on the server. Please configure TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY.",
        results: [],
        page: 1,
        totalPages: 0,
        configured: false,
      },
      { status: 503 }
    );
  }

  try {
    const data = await searchMovies(query, page);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("CineRelay movie search error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to search movies right now. Please try again.",
      },
      { status: 502 }
    );
  }
}
