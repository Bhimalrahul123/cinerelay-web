import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!supabaseUrl || !serviceKey || !razorpaySecret) {
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

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await admin.auth.getUser(token);

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
        { error: "Invalid order ID format." },
        { status: 400 }
      );
    }

    if (!razorpay_order_id || typeof razorpay_order_id !== "string") {
      return NextResponse.json(
        { error: "Missing Razorpay order ID." },
        { status: 400 }
      );
    }

    if (!razorpay_payment_id || typeof razorpay_payment_id !== "string") {
      return NextResponse.json(
        { error: "Missing Razorpay payment ID." },
        { status: 400 }
      );
    }

    if (
      !razorpay_signature ||
      typeof razorpay_signature !== "string" ||
      !/^[a-f0-9]{64}$/i.test(razorpay_signature)
    ) {
      return NextResponse.json(
        { error: "Invalid Razorpay payment signature format." },
        { status: 400 }
      );
    }

    // Official Razorpay signature verification:
    // HMAC-SHA256(order_id + "|" + payment_id, secret)
    const signPayload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = createHmac("sha256", razorpaySecret)
      .update(signPayload)
      .digest();

    const receivedSignature = Buffer.from(razorpay_signature, "hex");

    if (
      receivedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(receivedSignature, expectedSignature)
    ) {
      console.error("Razorpay signature verification failed for order:", orderId);
      return NextResponse.json(
        { error: "Payment verification signature mismatch. Security check failed." },
        { status: 400 }
      );
    }

    // Lookup order in Supabase
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, listing_id, buyer_id, amount_paise, status, razorpay_qr_id")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
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
      const { data: rpcResult, error: rpcError } = await admin.rpc(
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
      // Fallback to direct service_role database operation below
    }

    // If RPC was not available or not run yet, execute verified direct update
    if (!confirmed) {
      const { error: updateOrderErr } = await admin
        .from("orders")
        .update({
          status: "paid",
          razorpay_payment_id: razorpay_payment_id,
          paid_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("status", "pending");

      if (updateOrderErr) {
        console.error("Order status update failed:", updateOrderErr);
        return NextResponse.json(
          { error: "Could not update order status in database." },
          { status: 500 }
        );
      }

      // Mark listing as sold
      await admin
        .from("listings")
        .update({ status: "sold" })
        .eq("id", order.listing_id);
    }

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
