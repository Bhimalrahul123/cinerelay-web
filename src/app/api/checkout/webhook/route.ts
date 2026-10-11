import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface RazorpayPaymentEntity {
  id?: string;
  order_id?: string | null;
  qr_code_id?: string | null;
  status?: string;
  currency?: string;
  amount?: number;
  method?: string;
}

interface RazorpayQrEntity {
  id?: string;
  status?: string;
}

interface RazorpayOrderEntity {
  id?: string;
  status?: string;
  amount?: number;
}

interface RazorpayWebhookPayload {
  payment?: {
    entity?: RazorpayPaymentEntity;
  };
  qr_code?: {
    entity?: RazorpayQrEntity;
  };
  order?: {
    entity?: RazorpayOrderEntity;
  };
}

interface RazorpayWebhookEvent {
  event?: string;
  payload?: RazorpayWebhookPayload;
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!webhookSecret || !supabaseUrl || !serviceKey) {
      console.error("Webhook server configuration is incomplete.");
      return NextResponse.json(
        { error: "Webhook server configuration error." },
        { status: 500 }
      );
    }

    const signature = request.headers.get("x-razorpay-signature");

    if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
      return NextResponse.json(
        { error: "Invalid webhook signature format." },
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
      console.error("Webhook signature mismatch.");
      return NextResponse.json(
        { error: "Webhook signature verification failed." },
        { status: 401 }
      );
    }

    let event: RazorpayWebhookEvent;
    try {
      event = JSON.parse(rawBody) as RazorpayWebhookEvent;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON webhook payload." },
        { status: 400 }
      );
    }

    const eventName = event.event;

    // Supported confirmation events
    const isQrCredited = eventName === "qr_code.credited";
    const isPaymentCaptured = eventName === "payment.captured";
    const isOrderPaid = eventName === "order.paid";

    if (!isQrCredited && !isPaymentCaptured && !isOrderPaid) {
      // Safely acknowledge events that don't confirm payment
      return NextResponse.json({ received: true });
    }

    const payment = event.payload?.payment?.entity;
    const qrEntity = event.payload?.qr_code?.entity;
    const orderEntity = event.payload?.order?.entity;

    // Validate payment entity where applicable
    if (payment) {
      if (
        payment.currency !== "INR" ||
        typeof payment.amount !== "number" ||
        !Number.isSafeInteger(payment.amount) ||
        payment.amount <= 0 ||
        typeof payment.id !== "string"
      ) {
        console.error("Invalid payment payload values:", payment);
        return NextResponse.json(
          { error: "Invalid payment payload." },
          { status: 400 }
        );
      }
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let matchedOrder: {
      id: string;
      listing_id: string;
      amount_paise: number;
      status: string;
      razorpay_qr_id?: string | null;
    } | null = null;

    let paymentMethod: "upi_qr" | "card" = "upi_qr";
    const paymentId = payment?.id ?? "";
    const paymentAmount = payment?.amount ?? orderEntity?.amount ?? 0;

    // 1. Match UPI QR Payment
    const qrId = qrEntity?.id || payment?.qr_code_id;
    if (qrId && (isQrCredited || (isPaymentCaptured && payment?.qr_code_id))) {
      paymentMethod = "upi_qr";
      const { data: order, error: orderError } = await admin
        .from("orders")
        .select("id, listing_id, amount_paise, status, razorpay_qr_id")
        .eq("razorpay_qr_id", qrId)
        .maybeSingle();

      if (orderError) {
        console.error("Order lookup by QR failed:", orderError);
        return NextResponse.json(
          { error: "Database error querying order." },
          { status: 500 }
        );
      }

      matchedOrder = order;
    }

    // 2. Match Standard / Card Checkout Order
    const razorpayOrderId = payment?.order_id || orderEntity?.id;
    if (!matchedOrder && razorpayOrderId) {
      paymentMethod = "card";

      // Attempt lookup by razorpay_order_id first
      let { data: order, error: orderError } = await admin
        .from("orders")
        .select("id, listing_id, amount_paise, status, razorpay_qr_id")
        .eq("razorpay_order_id", razorpayOrderId)
        .maybeSingle();

      // If razorpay_order_id column doesn't exist yet, fallback to razorpay_qr_id
      if (orderError && orderError.code === "42703") {
        const fallback = await admin
          .from("orders")
          .select("id, listing_id, amount_paise, status, razorpay_qr_id")
          .eq("razorpay_qr_id", razorpayOrderId)
          .maybeSingle();
        order = fallback.data;
        orderError = fallback.error;
      }

      if (orderError) {
        console.error("Order lookup by Razorpay order ID failed:", orderError);
        return NextResponse.json(
          { error: "Database error querying order." },
          { status: 500 }
        );
      }

      matchedOrder = order;
    }

    if (!matchedOrder) {
      console.warn("No CineRelay order matched for event:", eventName, {
        qrId,
        razorpayOrderId,
      });
      return NextResponse.json(
        { error: "No matching order found for this payment reference." },
        { status: 404 }
      );
    }

    // Validate payment amount against verified order price
    if (Number(matchedOrder.amount_paise) !== paymentAmount) {
      console.error(
        `Amount mismatch: order requires ${matchedOrder.amount_paise} paise, received ${paymentAmount}`
      );
      return NextResponse.json(
        { error: "Payment amount mismatch." },
        { status: 400 }
      );
    }

    // Idempotency check: duplicate deliveries are safe
    if (matchedOrder.status === "paid") {
      return NextResponse.json({ received: true, alreadyPaid: true });
    }

    // Process payment confirmation safely
    if (paymentMethod === "upi_qr" && qrId) {
      // Call verified Supabase RPC
      let confirmed = false;
      try {
        const { data: rpcConfirmed, error: confirmError } = await admin.rpc(
          "cinerelay_confirm_qr_payment",
          {
            p_order_id: matchedOrder.id,
            p_payment_id: paymentId,
            p_qr_id: qrId,
            p_amount_paise: paymentAmount,
          }
        );

        if (!confirmError && rpcConfirmed === true) {
          confirmed = true;
        } else if (confirmError) {
          console.warn("cinerelay_confirm_qr_payment RPC error:", confirmError);
        }
      } catch (rpcErr) {
        console.warn("RPC invocation error:", rpcErr);
      }

      // If RPC did not execute or was not available, run verified server update
      if (!confirmed) {
        const { error: updateErr } = await admin
          .from("orders")
          .update({
            status: "paid",
            razorpay_payment_id: paymentId,
            paid_at: new Date().toISOString(),
          })
          .eq("id", matchedOrder.id);

        if (updateErr) {
          console.error("Direct order update failed:", updateErr);
          return NextResponse.json(
            { error: "Failed to update order status." },
            { status: 500 }
          );
        }

        await admin
          .from("listings")
          .update({ status: "sold" })
          .eq("id", matchedOrder.listing_id);
      }
    } else {
      // Card / Standard Checkout confirmation
      let confirmed = false;
      try {
        const { data: rpcConfirmed, error: confirmError } = await admin.rpc(
          "cinerelay_confirm_card_payment",
          {
            p_order_id: matchedOrder.id,
            p_payment_id: paymentId,
            p_razorpay_order_id: razorpayOrderId ?? "",
            p_amount_paise: paymentAmount,
          }
        );

        if (!confirmError && rpcConfirmed === true) {
          confirmed = true;
        }
      } catch {
        // Fallback to direct service_role update
      }

      if (!confirmed) {
        const { error: updateErr } = await admin
          .from("orders")
          .update({
            status: "paid",
            razorpay_payment_id: paymentId,
            paid_at: new Date().toISOString(),
          })
          .eq("id", matchedOrder.id);

        if (updateErr) {
          console.error("Direct card order update failed:", updateErr);
          return NextResponse.json(
            { error: "Failed to update card order status." },
            { status: 500 }
          );
        }

        await admin
          .from("listings")
          .update({ status: "sold" })
          .eq("id", matchedOrder.listing_id);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook unexpected error:", error);
    return NextResponse.json(
      { error: "Unexpected webhook processing error." },
      { status: 500 }
    );
  }
}
