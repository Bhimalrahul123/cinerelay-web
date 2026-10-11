import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const razorpayKey = process.env.RAZORPAY_KEY_ID;
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Server database configuration is missing." },
        { status: 500 }
      );
    }

    if (!razorpayKey || !razorpaySecret) {
      return NextResponse.json(
        { error: "Payment gateway credentials are not configured." },
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
    const { data: listing, error: listingError } = await admin
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
    await admin
      .from("orders")
      .update({ status: "expired" })
      .eq("listing_id", listingId)
      .eq("status", "pending")
      .lte("expires_at", now.toISOString());

    // Check for existing active pending orders on this listing
    const { data: activeOrders } = await admin
      .from("orders")
      .select("id, buyer_id, amount_paise, expires_at, razorpay_qr_id, qr_image_url, qr_short_url")
      .eq("listing_id", listingId)
      .eq("status", "pending")
      .gt("expires_at", now.toISOString());

    if (activeOrders && activeOrders.length > 0) {
      const activeOrder = activeOrders[0];

      // If another buyer has an active pending checkout
      if (activeOrder.buyer_id !== authData.user.id) {
        return NextResponse.json(
          {
            error: "Another buyer is currently checking out this ticket. Please check back in a few minutes.",
          },
          { status: 409 }
        );
      }

      // If this buyer already has an active pending order with an existing valid QR
      if (activeOrder.qr_image_url && activeOrder.amount_paise === amountPaise) {
        return NextResponse.json({
          orderId: activeOrder.id,
          amountPaise: activeOrder.amount_paise,
          expiresAt: activeOrder.expires_at,
          qrImageUrl: activeOrder.qr_image_url,
          qrShortUrl: activeOrder.qr_short_url ?? null,
        });
      }
    }

    // Set consistent 30-minute expiry
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
    const closeBySeconds = Math.floor(expiresAt.getTime() / 1000);

    // Call Razorpay QR Code API FIRST to avoid creating orphaned pending orders if Razorpay fails
    let qrResponse: Response;
    try {
      qrResponse = await fetch("https://api.razorpay.com/v1/payments/qr_codes", {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${razorpayKey}:${razorpaySecret}`).toString("base64"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "upi_qr",
          name: "CineRelay Ticket",
          usage: "single_use",
          fixed_amount: true,
          payment_amount: amountPaise,
          description: `CineRelay - ${listing.title.slice(0, 30)}`,
          close_by: closeBySeconds,
          notes: {
            listing_id: listing.id,
            buyer_id: authData.user.id,
          },
        }),
        cache: "no-store",
      });
    } catch (networkErr) {
      console.error("Razorpay QR network connection failure:", networkErr);
      return NextResponse.json(
        { error: "Could not reach the payment gateway. Please try again." },
        { status: 502 }
      );
    }

    const qr = await qrResponse.json();

    if (!qrResponse.ok || !qr.id || !qr.image_url) {
      console.error("Razorpay QR creation error:", qr);

      // Handle cases where the merchant account does not have UPI QR enabled
      const description =
        qr?.error?.description ||
        "The payment provider could not create a UPI QR code.";

      const isFeatureUnavailable =
        qr?.error?.code === "BAD_REQUEST_ERROR" &&
        (qr?.error?.description?.includes("not found on the server") ||
          qr?.error?.description?.includes("not enabled"));

      if (isFeatureUnavailable) {
        return NextResponse.json(
          {
            error:
              "Direct UPI QR generation is not enabled on this Razorpay account. Please use 'Pay with Card / Netbanking / UPI' to complete your payment.",
            code: "QR_NOT_SUPPORTED",
            details: description,
          },
          { status: 502 }
        );
      }

      return NextResponse.json(
        {
          error: description,
          code: qr?.error?.code ?? "QR_CREATION_FAILED",
        },
        { status: 502 }
      );
    }

    // Now insert the verified order into Supabase
    const orderPayload: Record<string, unknown> = {
      listing_id: listing.id,
      buyer_id: authData.user.id,
      seller_id: listing.seller_id,
      amount_paise: amountPaise,
      currency: "INR",
      status: "pending",
      expires_at: expiresAt.toISOString(),
      razorpay_qr_id: qr.id,
      qr_image_url: qr.image_url,
      qr_short_url: qr.short_url ?? null,
    };

    let { data: order, error: orderError } = await admin
      .from("orders")
      .insert({ ...orderPayload, payment_method: "upi_qr" })
      .select("id, amount_paise, expires_at")
      .single();

    // If payment_method column doesn't exist yet, retry without it
    if (orderError && orderError.code === "42703") {
      const fallbackResult = await admin
        .from("orders")
        .insert(orderPayload)
        .select("id, amount_paise, expires_at")
        .single();
      order = fallbackResult.data;
      orderError = fallbackResult.error;
    }

    if (orderError || !order) {
      console.error("Supabase order creation failure:", orderError);

      return NextResponse.json(
        {
          error: "Checkout initialization failed. Please refresh and try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      orderId: order.id,
      amountPaise: order.amount_paise,
      expiresAt: order.expires_at,
      qrImageUrl: qr.image_url,
      qrShortUrl: qr.short_url ?? null,
    });
  } catch (error) {
    console.error("Unexpected QR checkout error:", error);

    return NextResponse.json(
      { error: "Unexpected checkout error. Please try again." },
      { status: 500 }
    );
  }
}
