/**
 * Centralized environment variable resolution for CineRelay.
 * Trims values, removes accidental wrapping quotes, and resolves supported aliases.
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

function resolveFirst(...names: string[]): string {
  for (const name of names) {
    const val = clean(process.env[name]);
    if (val) return val;
  }
  return "";
}

// Razorpay Key ID
export function getRazorpayKeyId(): string {
  return resolveFirst(
    "RAZORPAY_KEY_ID",
    "NEXT_PUBLIC_RAZORPAY_KEY_ID",
    "RAZORPAY_KEY",
    "RAZORPAY_ID"
  );
}

// Razorpay Key Secret (Server-only)
export function getRazorpayKeySecret(): string {
  return resolveFirst(
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_SECRET",
    "RAZORPAY_SECRET_KEY",
    "RAZORPAY_API_SECRET"
  );
}

// Razorpay Webhook Secret (Server-only)
export function getRazorpayWebhookSecret(): string {
  return resolveFirst(
    "RAZORPAY_WEBHOOK_SECRET",
    "RAZORPAY_WEBHOOK_KEY",
    "RAZORPAY_SECRET_WEBHOOK"
  );
}

// Supabase URL
export function getSupabaseUrl(): string {
  return resolveFirst("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
}

// Supabase Anon / Publishable Key
export function getSupabaseAnonKey(): string {
  return resolveFirst(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY"
  );
}

// Supabase Service Role Key (Server-only)
export function getSupabaseServiceRoleKey(): string {
  return resolveFirst(
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_SECRET_KEY",
    "SERVICE_ROLE_KEY"
  );
}

export type TmdbAuth =
  | { type: "v3_key"; key: string }
  | { type: "v4_bearer"; token: string };

// TMDB Authentication: supports v3 32-hex API key or v4 JWT Bearer Token
export function getTmdbAuth(): TmdbAuth | null {
  const raw = resolveFirst(
    "TMDB_READ_ACCESS_TOKEN",
    "TMDB_API_KEY",
    "TMDB_ACCESS_TOKEN",
    "TMDB_BEARER_TOKEN",
    "TMDB_KEY",
    "NEXT_PUBLIC_TMDB_API_KEY",
    "NEXT_PUBLIC_TMDB_READ_ACCESS_TOKEN"
  );

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
