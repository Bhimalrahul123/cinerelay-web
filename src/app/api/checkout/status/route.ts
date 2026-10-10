
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Server environment variables are missing." },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!token) {
      return NextResponse.json(
        { error: "Please sign in." },
        { status: 401 }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: authData, error: authError } =
      await admin.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Invalid login session." },
        { status: 401 }
      );
    }

    const orderId = request.nextUrl.searchParams.get("orderId");

    if (
      !orderId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        orderId
      )
    ) {
      return NextResponse.json(
        { error: "Invalid order ID." },
        { status: 400 }
      );
    }

    const { data: order, error } = await admin
      .from("orders")
      .select("id, status, amount_paise, expires_at")
      .eq("id", orderId)
      .eq("buyer_id", authData.user.id)
      .maybeSingle();

    if (error) {
      console.error("Order status lookup failed:", error);

      return NextResponse.json(
        { error: "Could not check order status." },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    if (
      order.status === "pending" &&
      new Date(order.expires_at) <= new Date()
    ) {
      const { error: expireError } = await admin
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
    console.error("Order status API error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
