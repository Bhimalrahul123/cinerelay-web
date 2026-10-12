/**
 * Centralized environment variable resolution for CineRelay.
 * Trims values, removes accidental wrapping quotes, and resolves supported aliases.
 *
 * IMPORTANT FOR NEXT.JS:
 * Client-accessible variables (NEXT_PUBLIC_*) MUST be accessed directly as static
 * member expressions (e.g. process.env.NEXT_PUBLIC_XYZ) so that Turbopack / Webpack
 * can inline their values into client-side JavaScript bundles during compilation.
 */

function clean(value: string | undefined): string {
  if (!value) return "";
  let trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

// Supabase URL (client & server)
export function getSupabaseUrl(): string {
  return (
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    clean(process.env.SUPABASE_URL) ||
    ""
  );
}

// Supabase Anon / Publishable Key (client & server)
export function getSupabaseAnonKey(): string {
  return (
    clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    clean(process.env.SUPABASE_ANON_KEY) ||
    clean(process.env.SUPABASE_PUBLISHABLE_KEY) ||
    ""
  );
}

// Supabase Service Role Key (server-only)
export function getSupabaseServiceRoleKey(): string {
  return (
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    clean(process.env.SUPABASE_SERVICE_KEY) ||
    clean(process.env.SUPABASE_SECRET_KEY) ||
    clean(process.env.SERVICE_ROLE_KEY) ||
    ""
  );
}

// Check if Supabase client configuration is valid
export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return Boolean(
    url &&
      key &&
      !url.includes("placeholder.supabase.co") &&
      !key.includes("placeholder-anon-key")
  );
}

// Razorpay Key ID (client & server)
export function getRazorpayKeyId(): string {
  return (
    clean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) ||
    clean(process.env.RAZORPAY_KEY_ID) ||
    clean(process.env.RAZORPAY_KEY) ||
    clean(process.env.RAZORPAY_ID) ||
    ""
  );
}

// Razorpay Key Secret (server-only)
export function getRazorpayKeySecret(): string {
  return (
    clean(process.env.RAZORPAY_KEY_SECRET) ||
    clean(process.env.RAZORPAY_SECRET) ||
    clean(process.env.RAZORPAY_SECRET_KEY) ||
    clean(process.env.RAZORPAY_API_SECRET) ||
    ""
  );
}

// Razorpay Webhook Secret (server-only)
export function getRazorpayWebhookSecret(): string {
  return (
    clean(process.env.RAZORPAY_WEBHOOK_SECRET) ||
    clean(process.env.RAZORPAY_WEBHOOK_KEY) ||
    clean(process.env.RAZORPAY_SECRET_WEBHOOK) ||
    ""
  );
}

export type TmdbAuth =
  | { type: "v3_key"; key: string }
  | { type: "v4_bearer"; token: string };

// TMDB Authentication: supports v3 32-hex API key or v4 JWT Bearer Token
export function getTmdbAuth(): TmdbAuth | null {
  const raw =
    clean(process.env.TMDB_READ_ACCESS_TOKEN) ||
    clean(process.env.TMDB_API_KEY) ||
    clean(process.env.NEXT_PUBLIC_TMDB_API_KEY) ||
    clean(process.env.NEXT_PUBLIC_TMDB_READ_ACCESS_TOKEN) ||
    clean(process.env.TMDB_ACCESS_TOKEN) ||
    clean(process.env.TMDB_BEARER_TOKEN) ||
    clean(process.env.TMDB_KEY);

  if (!raw) return null;

  // TMDB v3 API Key is exactly 32 hexadecimal characters
  if (/^[a-f0-9]{32}$/i.test(raw)) {
    return { type: "v3_key", key: raw };
  }

  // TMDB v4 Read Access Token is a JWT / Bearer token
  return { type: "v4_bearer", token: raw };
}

/**
 * Applies TMDB authentication to a given fetch URL and headers.
 * If v3 key: appends `api_key` search parameter.
 * If v4 token: sets `Authorization: Bearer <token>` header.
 */
export function applyTmdbAuth(
  url: URL,
  headers: Record<string, string> = {}
): Record<string, string> {
  const auth = getTmdbAuth();
  if (!auth) return headers;

  if (auth.type === "v3_key") {
    url.searchParams.set("api_key", auth.key);
  } else {
    headers["Authorization"] = `Bearer ${auth.token}`;
  }

  return headers;
}
