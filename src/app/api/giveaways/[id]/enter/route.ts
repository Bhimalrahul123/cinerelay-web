import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseUrl,
  getSupabaseServiceRoleKey,
  getSupabaseAnonKey,
} from "@/lib/env";
import { enterLocalGiveaway } from "@/lib/giveaways-store";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: giveawayId } = await params;

    if (!giveawayId) {
      return NextResponse.json(
        { error: "Giveaway ID is required." },
        { status: 400 }
      );
    }

    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSupabaseServiceRoleKey();
    const anonKey = getSupabaseAnonKey();

    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    let userId = "";
    let userName = "Cinephile Participant";
    let userEmail: string | null = null;

    if (token && supabaseUrl && (serviceKey || anonKey)) {
      try {
        const authClient = createClient(supabaseUrl, anonKey || "anon", {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: authErr } = await authClient.auth.getUser();
        if (authErr || !userData.user) {
          return NextResponse.json(
            { error: "Please sign in to enter this giveaway." },
            { status: 401 }
          );
        }
        userId = userData.user.id;
        userEmail = userData.user.email ?? null;
        const meta = userData.user.user_metadata ?? {};
        userName = meta.full_name ?? meta.name ?? userData.user.email?.split("@")[0] ?? "Cinephile Participant";
      } catch {
        return NextResponse.json(
          { error: "Unable to authenticate session." },
          { status: 401 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Please sign in to enter this giveaway contest." },
        { status: 401 }
      );
    }

    // Try database entry if available
    let enteredInDb = false;
    if (supabaseUrl && serviceKey) {
      try {
        const dbClient = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { error: insertErr } = await dbClient.from("giveaway_entries").insert({
          giveaway_id: giveawayId,
          user_id: userId,
          user_name: userName,
          user_email: userEmail,
        });

        if (!insertErr) {
          enteredInDb = true;
        } else if (insertErr.code === "23505") {
          return NextResponse.json(
            { error: "You have already entered this giveaway contest!" },
            { status: 409 }
          );
        }
      } catch {
        // Fall back to local store
      }
    }

    // Also register in local memory store
    const localRes = enterLocalGiveaway(giveawayId, {
      id: `entry-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      giveaway_id: giveawayId,
      user_id: userId,
      user_name: userName,
      user_email: userEmail,
      created_at: new Date().toISOString(),
    });

    if (!localRes.success && !enteredInDb) {
      return NextResponse.json(
        { error: localRes.error || "Could not register giveaway entry." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "🎉 You have successfully entered the giveaway! Best of luck!",
    });
  } catch (error) {
    console.error("POST /api/giveaways/[id]/enter error:", error);
    return NextResponse.json(
      { error: "Could not process contest entry." },
      { status: 500 }
    );
  }
}
