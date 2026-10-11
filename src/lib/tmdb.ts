import { applyTmdbAuth, getTmdbAuth } from "./env";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export type MovieResult = {
  id: number;
  title: string;
  overview: string;
  posterUrl: string | null;
  releaseDate: string;
  rating: number;
};

async function fetchWithRetry(urlObj: URL, attempts = 3): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };

      // Clone URL so attempts don't mutate parameters repeatedly
      const targetUrl = new URL(urlObj.toString());
      applyTmdbAuth(targetUrl, headers);

      const response = await fetch(targetUrl.toString(), {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });

      // Retry temporary server errors and rate limits.
      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < attempts - 1
      ) {
        await response.body?.cancel();
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * (attempt + 1))
        );
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;

      if (attempt < attempts - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * (attempt + 1))
        );
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("TMDB could not be reached.");
}

export async function searchMovies(
  query: string,
  page = 1
): Promise<{ results: MovieResult[]; page: number; totalPages: number }> {
  const auth = getTmdbAuth();
  if (!auth) {
    throw new Error(
      "TMDB API credentials are not configured on the server. Please configure TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY."
    );
  }

  const url = new URL(`${TMDB_BASE_URL}/search/movie`);
  url.searchParams.set("query", query);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("language", "en-US");
  url.searchParams.set("page", String(Math.min(Math.max(page, 1), 500)));

  const response = await fetchWithRetry(url);

  if (!response.ok) {
    console.error("TMDB search request failed with status:", response.status);
    throw new Error(`TMDB search request failed with status ${response.status}.`);
  }

  const data = await response.json();

  const results: MovieResult[] = (data.results ?? []).map(
    (movie: {
      id: number;
      title: string;
      overview?: string;
      poster_path: string | null;
      release_date?: string;
      vote_average?: number;
    }) => ({
      id: movie.id,
      title: movie.title,
      overview: movie.overview ?? "",
      posterUrl: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : null,
      releaseDate: movie.release_date ?? "",
      rating: movie.vote_average ?? 0,
    })
  );

  return {
    results,
    page: data.page ?? page,
    totalPages: data.total_pages ?? 1,
  };
}
