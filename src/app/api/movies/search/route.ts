
import { NextRequest, NextResponse } from "next/server";
import { searchMovies } from "@/lib/tmdb";

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
        error: "Unable to search movies right now. Please try again.",
      },
      { status: 502 }
    );
  }
}
