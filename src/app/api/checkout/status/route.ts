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

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSupabaseServiceRoleKey();
    const anonKey = getSupabaseAnonKey();
    const razorpayKey = getRazorpayKeyId();
    const razorpaySecret = getRazorpayKeySecret();

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "Server configuration is missing." },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!token) {
      return NextResponse.json(
        { error: "Please sign in to check order status." },
        { status: 401 }
      );
    }

    const dbClient = serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      : createClient(supabaseUrl, anonKey || "placeholder-anon-key", {
          global: {
            headers: { Authorization: `Bearer ${token}` },
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });

    const { data: authData, error: authError } = await dbClient.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Your login session is invalid or has expired." },
        { status: 401 }
      );
    }

    const orderId = request.nextUrl.searchParams.get("orderId");

    if (!orderId || !UUID_REGEX.test(orderId)) {
      return NextResponse.json(
        { error: "Invalid order ID format." },
        { status: 400 }
      );
    }

    // Query order
    const { data: order, error } = await dbClient
      .from("orders")
      .select("id, status, amount_paise, expires_at, buyer_id, seller_id, listing_id, razorpay_qr_id, razorpay_payment_id")
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      console.error("Order status lookup query failed:", error);
      return NextResponse.json(
        { error: "Could not retrieve order status." },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    // Access control: only the buyer or seller can view this order
    const isAuthorized =
      order.buyer_id === authData.user.id || order.seller_id === authData.user.id;

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "You are not authorized to view this order." },
        { status: 403 }
      );
    }

    // Safe Expiry Handling:
    // If pending and expires_at has passed, verify with Razorpay before marking expired
    // to prevent expiring an order during a legitimate captured-payment race.
    if (order.status === "pending" && new Date(order.expires_at) <= new Date()) {
      let paymentConfirmedOnGateway = false;

      // Check if Razorpay keys are available to verify gateway status
      if (razorpayKey && razorpaySecret && order.razorpay_qr_id) {
        try {
          const authHeader =
            "Basic " +
            Buffer.from(`${razorpayKey}:${razorpaySecret}`).toString("base64");

          // Check if razorpay_qr_id starts with 'order_' (Standard order)
          if (order.razorpay_qr_id.startsWith("order_")) {
            const rzpRes = await fetch(
              `https://api.razorpay.com/v1/orders/${order.razorpay_qr_id}`,
              { headers: { Authorization: authHeader }, cache: "no-store" }
            );
            if (rzpRes.ok) {
              const rzpData = await rzpRes.json();
              if (rzpData.status === "paid") {
                paymentConfirmedOnGateway = true;
              }
            }
          }
        } catch (gatewayErr) {
          console.warn("Could not check gateway status on expiry check:", gatewayErr);
        }
      }

      if (paymentConfirmedOnGateway) {
        // Update to paid
        await dbClient
          .from("orders")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        await dbClient
          .from("listings")
          .update({ status: "sold" })
          .eq("id", order.listing_id);

        return NextResponse.json({
          orderId: order.id,
          status: "paid",
          amountPaise: order.amount_paise,
          expiresAt: order.expires_at,
        });
      }

      // No payment confirmed on gateway -> safely mark expired
      const { error: expireError } = await dbClient
        .from("orders")
        .update({ status: "expired" })
        .eq("id", order.id)
        .eq("status", "pending");

      if (expireError) {
        console.error("Order expiry update failed:", expireError);
        return NextResponse.json(
          { error: "Could not update order status." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        orderId: order.id,
        status: "expired",
        amountPaise: order.amount_paise,
        expiresAt: order.expires_at,
      });
    }

    return NextResponse.json({
      orderId: order.id,
      status: order.status,
      amountPaise: order.amount_paise,
      expiresAt: order.expires_at,
    });
  } catch (error) {
    console.error("Order status API unexpected error:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
