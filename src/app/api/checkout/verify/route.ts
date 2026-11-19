import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getRazorpayKeySecret,
  getSupabaseUrl,
  getSupabaseServiceRoleKey,
  getSupabaseAnonKey,
} from "@/lib/env";
import { getCachedOrder, updateCachedOrder } from "@/lib/orders-store";

export const runtime = "nodejs";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSupabaseServiceRoleKey();
    const anonKey = getSupabaseAnonKey();
    const razorpaySecret = getRazorpayKeySecret();

    if (!supabaseUrl || !razorpaySecret) {
      return NextResponse.json(
        { error: "Server payment configuration is missing." },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!token) {
      return NextResponse.json(
        { error: "Please log in to verify payment." },
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

    let body: {
      orderId?: string;
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const {
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (!orderId || !UUID_REGEX.test(orderId)) {
      return NextResponse.json(
        { error: "Invalid order ID." },
        { status: 400 }
      );
    }

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      typeof razorpay_signature !== "string"
    ) {
      return NextResponse.json(
        { error: "Missing required Razorpay payment confirmation parameters." },
        { status: 400 }
      );
    }

    // Verify signature using timing-safe comparison: HMAC-SHA256(order_id + "|" + payment_id, secret)
    const expectedPayload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedDigest = createHmac("sha256", razorpaySecret)
      .update(expectedPayload)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedDigest, "utf8");
    const receivedBuffer = Buffer.from(razorpay_signature, "utf8");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      console.error("Razorpay signature mismatch for order:", orderId);
      return NextResponse.json(
        { error: "Invalid payment signature." },
        { status: 400 }
      );
    }

    // Double-check payment status with Razorpay API using key credentials
    const razorpayKey = process.env.RAZORPAY_KEY_ID;
    if (razorpayKey) {
      try {
        const authBasic = Buffer.from(`${razorpayKey}:${razorpaySecret}`).toString("base64");
        const paymentCheckRes = await fetch(
          `https://api.razorpay.com/v1/payments/${razorpay_payment_id}`,
          {
            headers: { Authorization: `Basic ${authBasic}` },
            cache: "no-store",
          }
        );
        if (paymentCheckRes.ok) {
          const paymentData = await paymentCheckRes.json();
          if (
            paymentData.status !== "captured" &&
            paymentData.status !== "authorized"
          ) {
            return NextResponse.json(
              {
                error: `Payment is not successful with provider (status: ${paymentData.status}).`,
              },
              { status: 400 }
            );
          }
        }
      } catch (err) {
        console.warn("Direct Razorpay payment check warning:", err);
      }
    }

    // Lookup order in Supabase or resilient cache
    let order: {
      id: string;
      listing_id: string;
      buyer_id: string;
      amount_paise: number;
      status: string;
      razorpay_qr_id?: string | null;
    } | null = null;

    const { data: dbOrder } = await dbClient
      .from("orders")
      .select("id, listing_id, buyer_id, amount_paise, status, razorpay_qr_id")
      .eq("id", orderId)
      .maybeSingle();

    if (dbOrder) {
      order = dbOrder;
    } else {
      const cached = getCachedOrder(orderId);
      if (cached) {
        order = {
          id: cached.id,
          listing_id: cached.listing_id,
          buyer_id: cached.buyer_id,
          amount_paise: cached.amount_paise,
          status: cached.status,
          razorpay_qr_id: cached.razorpay_order_id || cached.razorpay_qr_id,
        };
      }
    }

    if (!order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    if (order.buyer_id !== authData.user.id) {
      return NextResponse.json(
        { error: "You are not authorized to verify this order." },
        { status: 403 }
      );
    }

    // Idempotent: already marked paid
    if (order.status === "paid") {
      return NextResponse.json({
        success: true,
        orderId: order.id,
        status: "paid",
        alreadyConfirmed: true,
      });
    }

    if (order.status !== "pending") {
      return NextResponse.json(
        { error: `Order is not in pending status (current status: ${order.status}).` },
        { status: 409 }
      );
    }

    // First attempt confirmation via RPC if migration was executed
    let confirmed = false;
    try {
      const { data: rpcResult, error: rpcError } = await dbClient.rpc(
        "cinerelay_confirm_card_payment",
        {
          p_order_id: order.id,
          p_payment_id: razorpay_payment_id,
          p_razorpay_order_id: razorpay_order_id,
          p_amount_paise: order.amount_paise,
        }
      );
      if (!rpcError && rpcResult === true) {
        confirmed = true;
      }
    } catch {
      // Fallback to direct database operation below
    }

    // If RPC was not available or not run yet, execute verified direct update
    if (!confirmed) {
      let updateOrderErr = (await dbClient
        .from("orders")
        .update({
          status: "paid",
          razorpay_payment_id: razorpay_payment_id,
          paid_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("status", "pending")).error;

      if (
        updateOrderErr &&
        (updateOrderErr.code === "PGRST204" ||
          updateOrderErr.code === "42703" ||
          String(updateOrderErr.message).includes("paid_at"))
      ) {
        updateOrderErr = (await dbClient
          .from("orders")
          .update({
            status: "paid",
            razorpay_payment_id: razorpay_payment_id,
          })
          .eq("id", order.id)
          .eq("status", "pending")).error;
      }

      if (updateOrderErr) {
        console.warn("Direct Supabase order status update notice:", updateOrderErr);
      }

      // Mark listing as sold
      await dbClient
        .from("listings")
        .update({ status: "sold" })
        .eq("id", order.listing_id);
    }

    // Always update local cache state to paid
    updateCachedOrder(order.id, {
      status: "paid",
      razorpay_payment_id: razorpay_payment_id,
      paid_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      status: "paid",
    });
  } catch (error) {
    console.error("Payment verification API error:", error);
    return NextResponse.json(
      { error: "Unexpected payment verification error." },
      { status: 500 }
    );
  }
}
