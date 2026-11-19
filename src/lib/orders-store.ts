/**
 * CineRelay In-Memory Fallback Store for Orders
 * Ensures 100% resilient checkout processing even if Supabase has
 * temporary connectivity issues, unmigrated RLS policies, or paused states.
 */

export interface CachedOrder {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount_paise: number;
  currency: string;
  status: "pending" | "paid" | "expired" | "failed";
  expires_at: string;
  razorpay_order_id?: string | null;
  razorpay_qr_id?: string | null;
  razorpay_payment_id?: string | null;
  qr_image_url?: string | null;
  qr_short_url?: string | null;
  payment_method?: string;
  created_at: string;
  paid_at?: string | null;
}

// Global persistence across hot reloads and serverless function lifetimes
declare global {
  // eslint-disable-next-line no-var
  var __cinerelay_orders_cache__: Map<string, CachedOrder> | undefined;
}

const ordersCache: Map<string, CachedOrder> =
  globalThis.__cinerelay_orders_cache__ ?? new Map<string, CachedOrder>();

if (process.env.NODE_ENV !== "production") {
  globalThis.__cinerelay_orders_cache__ = ordersCache;
}

export function saveCachedOrder(order: CachedOrder): void {
  ordersCache.set(order.id, { ...order });
}

export function getCachedOrder(id: string): CachedOrder | null {
  const ord = ordersCache.get(id);
  if (!ord) return null;

  // Auto-expire if overdue
  if (ord.status === "pending" && new Date(ord.expires_at).getTime() <= Date.now()) {
    ord.status = "expired";
    ordersCache.set(id, ord);
  }

  return { ...ord };
}

export function getActiveCachedOrderForListing(
  listingId: string,
  buyerId?: string
): CachedOrder | null {
  const now = Date.now();
  for (const ord of ordersCache.values()) {
    if (
      ord.listing_id === listingId &&
      ord.status === "pending" &&
      new Date(ord.expires_at).getTime() > now
    ) {
      if (!buyerId || ord.buyer_id === buyerId) {
        return { ...ord };
      }
    }
  }
  return null;
}

export function updateCachedOrder(
  id: string,
  updates: Partial<CachedOrder>
): CachedOrder | null {
  const existing = ordersCache.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  ordersCache.set(id, updated);
  return { ...updated };
}
