import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getRazorpayKeyId,
  getRazorpayKeySecret,
  getSupabaseUrl,
  getSupabaseServiceRoleKey,
  getSupabaseAnonKey,
} from "@/lib/env";

export const runtime = "nodejs";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSupabaseServiceRoleKey();
    const anonKey = getSupabaseAnonKey();
    const razorpayKey = getRazorpayKeyId();
    const razorpaySecret = getRazorpayKeySecret();

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "Server database configuration is missing." },
        { status: 500 }
      );
    }

    if (!razorpayKey || !razorpaySecret) {
      return NextResponse.json(
        {
          error:
            "Payment gateway credentials are not configured. Please ensure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are configured in the server environment.",
        },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!token) {
      return NextResponse.json(
        { error: "Please log in before checkout." },
        { status: 401 }
      );
    }

    const dbClient = serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : createClient(supabaseUrl, anonKey || "placeholder-anon-key", {
          global: {
            headers: { Authorization: `Bearer ${token}` },
          },
          auth: { persistSession: false, autoRefreshToken: false },
        });

    const { data: authData, error: authError } = await dbClient.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Your login session is invalid or has expired." },
        { status: 401 }
      );
    }

    let body: { listingId?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const listingId = String(body.listingId ?? "").trim();

    if (!UUID_REGEX.test(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID format." },
        { status: 400 }
      );
    }

    // Verify listing directly from database
    const { data: listing, error: listingError } = await dbClient
      .from("listings")
      .select("id, seller_id, title, price, status")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError || !listing) {
      return NextResponse.json(
        { error: "This ticket could not be found." },
        { status: 404 }
      );
    }

    if (listing.status !== "approved") {
      return NextResponse.json(
        { error: `This ticket is not available for purchase (status: ${listing.status}).` },
        { status: 400 }
      );
    }

    if (listing.seller_id === authData.user.id) {
      return NextResponse.json(
        { error: "You cannot purchase your own listing." },
        { status: 400 }
      );
    }

    // Server-side amount derivation (never from client)
    const amountPaise = Math.round(Number(listing.price) * 100);

    if (
      !Number.isSafeInteger(amountPaise) ||
      amountPaise < 100 ||
      amountPaise > 100000000
    ) {
      return NextResponse.json(
        { error: "Invalid ticket price." },
        { status: 400 }
      );
    }

    const now = new Date();

    // Expire overdue pending orders for this listing
    await dbClient
      .from("orders")
      .update({ status: "expired" })
      .eq("listing_id", listingId)
      .eq("status", "pending")
      .lte("expires_at", now.toISOString());

    // Check for existing active pending orders on this listing
    const { data: activeOrders } = await dbClient
      .from("orders")
      .select("id, buyer_id, amount_paise, expires_at")
      .eq("listing_id", listingId)
      .eq("status", "pending")
      .gt("expires_at", now.toISOString());

    if (activeOrders && activeOrders.length > 0) {
      const activeOrder = activeOrders[0];
      if (activeOrder.buyer_id !== authData.user.id) {
        return NextResponse.json(
          {
            error: "Another buyer is currently checking out this ticket. Please check back in a few minutes.",
          },
          { status: 409 }
        );
      }
    }

    // Set 30-minute expiry
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

    // Create pending order record in Supabase
    const orderPayload: Record<string, unknown> = {
      listing_id: listing.id,
      buyer_id: authData.user.id,
      seller_id: listing.seller_id,
      amount_paise: amountPaise,
      currency: "INR",
      status: "pending",
      expires_at: expiresAt.toISOString(),
    };

    let { data: order, error: orderError } = await dbClient
      .from("orders")
      .insert({ ...orderPayload, payment_method: "card" })
      .select("id, amount_paise, expires_at")
      .single();

    if (orderError && orderError.code === "42703") {
      const fallbackResult = await dbClient
        .from("orders")
        .insert(orderPayload)
        .select("id, amount_paise, expires_at")
        .single();
      order = fallbackResult.data;
      orderError = fallbackResult.error;
    }

    if (orderError || !order) {
      console.error("Order creation in Supabase failed:", orderError);
      return NextResponse.json(
        { error: "Could not initialize checkout order in database." },
        { status: 500 }
      );
    }

    // Create standard payment order in Razorpay
    const authHeader = Buffer.from(`${razorpayKey}:${razorpaySecret}`).toString("base64");
    const receiptId = `cr_ord_${order.id.replace(/-/g, "").slice(0, 20)}`;

    let razorpayRes: Response;
    try {
      razorpayRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt: receiptId,
          notes: {
            order_id: order.id,
            listing_id: listing.id,
            buyer_id: authData.user.id,
          },
        }),
        cache: "no-store",
      });
    } catch (networkErr) {
      console.error("Razorpay order API network error:", networkErr);
      await dbClient.from("orders").update({ status: "failed" }).eq("id", order.id);
      return NextResponse.json(
        { error: "Could not reach the payment gateway. Please try again." },
        { status: 502 }
      );
    }

    const razorpayOrder = await razorpayRes.json();

    if (!razorpayRes.ok || !razorpayOrder.id) {
      console.error("Razorpay order creation error:", razorpayOrder);
      await dbClient.from("orders").update({ status: "failed" }).eq("id", order.id);
      return NextResponse.json(
        {
          error:
            razorpayOrder?.error?.description ||
            "Unable to create payment order with provider.",
        },
        { status: 502 }
      );
    }

    // Update order with razorpay_order_id (and fallback to razorpay_qr_id if razorpay_order_id column doesn't exist yet)
    const updateResult = await dbClient
      .from("orders")
      .update({
        razorpay_order_id: razorpayOrder.id,
      })
      .eq("id", order.id);

    if (updateResult.error && updateResult.error.code === "42703") {
      // Store in razorpay_qr_id as safe fallback before migration is run
      await dbClient
        .from("orders")
        .update({
          razorpay_qr_id: razorpayOrder.id,
        })
        .eq("id", order.id);
    }

    const metadata = authData.user.user_metadata ?? {};

    return NextResponse.json({
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amountPaise: order.amount_paise,
      currency: "INR",
      keyId: razorpayKey,
      listingTitle: listing.title,
      expiresAt: order.expires_at,
      buyerEmail: authData.user.email ?? null,
      buyerName:
        metadata.full_name ?? metadata.name ?? metadata.display_name ?? null,
      buyerPhone: metadata.phone_number ?? metadata.phone ?? null,
    });
  } catch (error) {
    console.error("Unexpected card order checkout error:", error);
    return NextResponse.json(
      { error: "Unexpected error creating payment order." },
      { status: 500 }
    );
  }
}
