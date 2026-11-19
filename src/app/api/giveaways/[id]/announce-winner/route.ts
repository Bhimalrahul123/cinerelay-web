import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseUrl,
  getSupabaseServiceRoleKey,
  getSupabaseAnonKey,
} from "@/lib/env";
import { announceLocalGiveawayWinner } from "@/lib/giveaways-store";

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

    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!token) {
      return NextResponse.json(
        { error: "Please log in to announce the winner." },
        { status: 401 }
      );
    }

    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSupabaseServiceRoleKey();
    const anonKey = getSupabaseAnonKey();

    let hostUserId = "";
    if (supabaseUrl && (serviceKey || anonKey)) {
      try {
        const authClient = createClient(supabaseUrl, anonKey || "anon", {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData } = await authClient.auth.getUser();
        hostUserId = userData.user?.id ?? "";
      } catch {
        // Continue
      }
    }

    let body: { winnerName?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const winnerName = String(body.winnerName ?? "").trim();
    if (!winnerName) {
      return NextResponse.json(
        { error: "Please provide the name of the winner." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const winnerObj = [
      {
        user_id: `host-winner-${Date.now().toString(36)}`,
        user_name: winnerName,
        drawn_at: now,
      },
    ];

    // 1. Update in Supabase if available
    let dbUpdated = false;
    if (supabaseUrl && serviceKey) {
      try {
        const dbClient = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: ga } = await dbClient
          .from("giveaways")
          .select("id, host_id")
          .eq("id", giveawayId)
          .maybeSingle();

        if (ga) {
          if (hostUserId && ga.host_id && ga.host_id !== hostUserId) {
            return NextResponse.json(
              { error: "Only the host can announce the winner for this giveaway." },
              { status: 403 }
            );
          }

          const { error: updateErr } = await dbClient
            .from("giveaways")
            .update({
              status: "ended",
              winners: winnerObj,
            })
            .eq("id", giveawayId);

          if (!updateErr) {
            dbUpdated = true;
          }
        }
      } catch (err) {
        console.warn("Supabase announce winner warning:", err);
      }
    }

    // 2. Always update local store
    const localRes = announceLocalGiveawayWinner(giveawayId, winnerName, hostUserId);

    if (!dbUpdated && !localRes.success) {
      return NextResponse.json(
        { error: localRes.error || "Could not update giveaway winner." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      giveaway: localRes.giveaway ?? {
        id: giveawayId,
        status: "ended",
        winners: winnerObj,
      },
    });
  } catch (error) {
    console.error("POST /api/giveaways/[id]/announce-winner error:", error);
    return NextResponse.json(
      { error: "Unexpected error announcing giveaway winner." },
      { status: 500 }
    );
  }
}
