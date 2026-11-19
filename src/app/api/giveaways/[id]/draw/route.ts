import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseUrl,
  getSupabaseServiceRoleKey,
} from "@/lib/env";
import { drawLocalWinner } from "@/lib/giveaways-store";
import { selectFairWinners, GiveawayEntry } from "@/lib/giveaways";

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

    // 1. Try drawing with Supabase entries
    let dbWinnersDrawn = false;
    let winnersList: ReturnType<typeof selectFairWinners> = [];

    if (supabaseUrl && serviceKey) {
      try {
        const dbClient = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: giveaway } = await dbClient
          .from("giveaways")
          .select("id, winners_count, status")
          .eq("id", giveawayId)
          .maybeSingle();

        if (giveaway) {
          const { data: entries } = await dbClient
            .from("giveaway_entries")
            .select("*")
            .eq("giveaway_id", giveawayId);

          const list = (entries ?? []) as GiveawayEntry[];
          winnersList = selectFairWinners(list, giveaway.winners_count || 1);

          await dbClient
            .from("giveaways")
            .update({
              status: "ended",
              winners: winnersList,
            })
            .eq("id", giveawayId);

          dbWinnersDrawn = true;
        }
      } catch {
        // Fall back to local draw
      }
    }

    // 2. Also execute in local fallback store
    const localResult = drawLocalWinner(giveawayId);

    if (!dbWinnersDrawn && !localResult.success) {
      return NextResponse.json(
        { error: localResult.error || "Could not draw winner for this contest." },
        { status: 400 }
      );
    }

    const finalWinners = dbWinnersDrawn ? winnersList : localResult.winners;

    return NextResponse.json({
      success: true,
      winners: finalWinners,
      message: "🏆 Winner(s) successfully drawn and announced!",
    });
  } catch (error) {
    console.error("POST /api/giveaways/[id]/draw error:", error);
    return NextResponse.json(
      { error: "Unexpected error drawing winner." },
      { status: 500 }
    );
  }
}
