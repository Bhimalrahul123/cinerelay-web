
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!webhookSecret || !supabaseUrl || !serviceKey) {
      console.error("Webhook environment variables are missing.");

      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      );
    }

    const signature = request.headers.get("x-razorpay-signature");

    if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 400 }
      );
    }

    const rawBody = await request.text();

    const expectedSignature = createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest();

    const receivedSignature = Buffer.from(signature, "hex");

    if (
      receivedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(receivedSignature, expectedSignature)
    ) {
      return NextResponse.json(
        { error: "Webhook signature verification failed." },
        { status: 401 }
      );
    }

    let event: any;

    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload." },
        { status: 400 }
      );
    }

    // Ignore events that do not confirm a captured payment.
    if (event.event !== "payment.captured") {
      return NextResponse.json({ received: true });
    }

    const payment = event.payload?.payment?.entity;

    if (
      !payment ||
      payment.status !== "captured" ||
      payment.currency !== "INR" ||
      !Number.isSafeInteger(payment.amount) ||
      payment.amount <= 0 ||
      typeof payment.id !== "string" ||
      typeof payment.qr_code_id !== "string"
    ) {
      console.error("Invalid captured-payment payload.");

      return NextResponse.json(
        { error: "Invalid payment details." },
        { status: 400 }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, amount_paise, status, razorpay_qr_id")
      .eq("razorpay_qr_id", payment.qr_code_id)
      .maybeSingle();

    if (orderError) {
      console.error("Webhook order lookup failed:", orderError);

      return NextResponse.json(
        { error: "Could not verify the order." },
        { status: 500 }
      );
    }

    if (!order) {
      console.error("No order found for captured QR payment.");

      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    if (Number(order.amount_paise) !== payment.amount) {
      console.error("Payment amount does not match the order.");

      return NextResponse.json(
        { error: "Payment amount mismatch." },
        { status: 400 }
      );
    }

    // Duplicate delivery of the same successful event is safe.
    if (order.status === "paid") {
      return NextResponse.json({ received: true });
    }

    if (order.status !== "pending") {
      console.error("Payment received for a non-pending order:", order.id);

      return NextResponse.json(
        { error: "Order is not pending; manual reconciliation required." },
        { status: 409 }
      );
    }

    const { data: confirmed, error: confirmError } = await admin.rpc(
      "cinerelay_confirm_qr_payment",
      {
        p_order_id: order.id,
        p_payment_id: payment.id,
        p_qr_id: payment.qr_code_id,
        p_amount_paise: payment.amount,
      }
    );

    if (confirmError || confirmed !== true) {
      console.error("Payment confirmation failed:", confirmError);

      return NextResponse.json(
        { error: "Payment needs reconciliation." },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook error:", error);

    return NextResponse.json(
      { error: "Unexpected webhook error." },
      { status: 500 }
    );
  }
}
