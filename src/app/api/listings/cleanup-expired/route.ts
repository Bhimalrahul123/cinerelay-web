import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseUrl,
  getSupabaseServiceRoleKey,
  getSupabaseAnonKey,
} from "@/lib/env";
import { isTicketExpired } from "@/lib/expiration";

export const runtime = "nodejs";

interface ListingRow {
  id: string;
  title: string;
  event_date: string | null;
  event_time: string | null;
  status: string;
}

export async function POST() {
  return handleCleanup();
}

export async function GET() {
  return handleCleanup();
}

async function handleCleanup() {
  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSupabaseServiceRoleKey();
    const anonKey = getSupabaseAnonKey();

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "Database configuration is missing." },
        { status: 500 }
      );
    }

    // Prefer service role client if available, else anon client
    const dbClient = serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : createClient(supabaseUrl, anonKey || "placeholder-anon-key", {
          auth: { persistSession: false, autoRefreshToken: false },
        });

    // 1. Try invoking dedicated RPC if available
    try {
      const { data: rpcCount, error: rpcError } = await dbClient.rpc(
        "cinerelay_expire_past_listings"
      );
      if (!rpcError && typeof rpcCount === "number") {
        return NextResponse.json({
          success: true,
          method: "rpc",
          expiredCount: rpcCount,
        });
      }
    } catch {
      // RPC not configured yet; continue to direct check below
    }

    // 2. Fetch all approved listings with an event date
    const { data: candidateListings, error: fetchErr } = await dbClient
      .from("listings")
      .select("id, title, event_date, event_time, status")
      .eq("status", "approved")
      .not("event_date", "is", null);

    if (fetchErr) {
      console.error("Cleanup-expired fetch error:", fetchErr);
      return NextResponse.json(
        { error: "Could not fetch listings to check expiration." },
        { status: 500 }
      );
    }

    const rows = (candidateListings ?? []) as ListingRow[];
    const expiredIds: string[] = [];

    for (const item of rows) {
      if (isTicketExpired(item.event_date, item.event_time)) {
        expiredIds.push(item.id);
      }
    }

    if (expiredIds.length === 0) {
      return NextResponse.json({
        success: true,
        method: "scanner",
        expiredCount: 0,
        message: "No expired tickets found.",
      });
    }

    // 3. Mark expired listings in database
    const { error: updateErr } = await dbClient
      .from("listings")
      .update({ status: "expired" })
      .in("id", expiredIds);

    if (updateErr) {
      console.warn("Cleanup-expired batch update error (may require RLS/RPC permissions):", updateErr);
      return NextResponse.json({
        success: false,
        expiredDetected: expiredIds.length,
        expiredIds,
        error: updateErr.message,
      });
    }

    return NextResponse.json({
      success: true,
      method: "scanner",
      expiredCount: expiredIds.length,
      expiredIds,
      message: `Successfully marked ${expiredIds.length} expired listing(s) as expired.`,
    });
  } catch (error) {
    console.error("Unexpected error in cleanup-expired:", error);
    return NextResponse.json(
      { error: "Unexpected error during expiration cleanup." },
      { status: 500 }
    );
  }
}
