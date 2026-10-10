
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const razorpayKey = process.env.RAZORPAY_KEY_ID;
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!supabaseUrl || !serviceKey || !razorpayKey || !razorpaySecret) {
      return NextResponse.json(
        { error: "Payment environment variables are missing." },
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

    const { data: authData, error: authError } =
      await admin.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Your login session is invalid." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const listingId = String(body.listingId ?? "");

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        listingId
      )
    ) {
      return NextResponse.json(
        { error: "Invalid listing ID." },
        { status: 400 }
      );
    }

    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("id, seller_id, title, price, status")
      .eq("id", listingId)
      .eq("status", "approved")
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        { error: "This ticket is unavailable." },
        { status: 404 }
      );
    }

    if (listing.seller_id === authData.user.id) {
      return NextResponse.json(
        { error: "You cannot buy your own ticket." },
        { status: 400 }
      );
    }

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
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

    await admin
      .from("orders")
      .update({ status: "expired" })
      .eq("listing_id", listingId)
      .eq("status", "pending")
      .lte("expires_at", now.toISOString());

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        listing_id: listing.id,
        buyer_id: authData.user.id,
        seller_id: listing.seller_id,
        amount_paise: amountPaise,
        currency: "INR",
        status: "pending",
        expires_at: expiresAt.toISOString(),
      })
      .select("id, amount_paise, expires_at")
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        {
          error:
            "This ticket may already have an active checkout. Please refresh and try again.",
        },
        { status: 409 }
      );
    }

    const qrResponse = await fetch(
      "https://api.razorpay.com/v1/payments/qr_codes",
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${razorpayKey}:${razorpaySecret}`).toString(
              "base64"
            ),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "upi_qr",
          name: "CineRelay Ticket",
          usage: "single_use",
          fixed_amount: true,
          payment_amount: amountPaise,
          description: `CineRelay order ${order.id}`,
          close_by: Math.floor(expiresAt.getTime() / 1000),
          notes: {
            cinerelay_order_id: order.id,
            listing_id: listing.id,
          },
        }),
        cache: "no-store",
      }
    );

    const qr = await qrResponse.json();

    if (!qrResponse.ok || !qr.id || !qr.image_url) {
      console.error("Razorpay QR error:", qr);

      await admin
        .from("orders")
        .update({ status: "failed" })
        .eq("id", order.id);

      return NextResponse.json(
        {
          error:
            "QR creation failed. Check your Razorpay API access and account eligibility.",
        },
        { status: 502 }
      );
    }

    const { error: updateError } = await admin
      .from("orders")
      .update({
        razorpay_qr_id: qr.id,
        qr_image_url: qr.image_url,
        qr_short_url: qr.short_url ?? null,
      })
      .eq("id", order.id)
      .eq("status", "pending");

    if (updateError) {
      console.error("Saving QR details failed:", updateError);

      return NextResponse.json(
        { error: "Could not save checkout details." },
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
    console.error("QR checkout error:", error);

    return NextResponse.json(
      { error: "Unexpected checkout error." },
      { status: 500 }
    );
  }
}
