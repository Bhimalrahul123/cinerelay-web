import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseUrl,
  getSupabaseServiceRoleKey,
  getSupabaseAnonKey,
} from "@/lib/env";
import { Giveaway } from "@/lib/giveaways";
import {
  getLocalGiveaways,
  addLocalGiveaway,
} from "@/lib/giveaways-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSupabaseServiceRoleKey();
    const anonKey = getSupabaseAnonKey();

    // Check optional user auth header to see if user has already entered
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    let currentUserId: string | null = null;

    if (token && supabaseUrl && (serviceKey || anonKey)) {
      try {
        const authClient = createClient(supabaseUrl, anonKey || "anon", {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData } = await authClient.auth.getUser();
        currentUserId = userData.user?.id ?? null;
      } catch {
        // Continue unauthenticated
      }
    }

    // 1. Try querying Supabase if available
    let dbGiveaways: Giveaway[] | null = null;
    if (supabaseUrl && (serviceKey || anonKey)) {
      try {
        const dbClient = createClient(supabaseUrl, serviceKey || anonKey || "", {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data, error } = await dbClient
          .from("giveaways")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(data)) {
          dbGiveaways = data as Giveaway[];
        }
      } catch {
        // Fall back to local giveaways
      }
    }

    // Merge or fallback to local in-memory store
    const localList = getLocalGiveaways();
    const combinedMap = new Map<string, Giveaway>();

    // Add local seed/user giveaways
    for (const ga of localList) {
      combinedMap.set(ga.id, ga);
    }

    // Add DB giveaways if available
    if (dbGiveaways) {
      for (const ga of dbGiveaways) {
        combinedMap.set(ga.id, ga);
      }
    }

    const giveaways = Array.from(combinedMap.values());

    // Check has_entered for each contest
    const enriched = giveaways.map((ga) => {
      let hasEntered = false;
      if (currentUserId && Array.isArray(ga.winners)) {
        hasEntered = ga.winners.some((w) => w.user_id === currentUserId);
      }
      return {
        ...ga,
        has_entered: hasEntered,
      };
    });

    return NextResponse.json({
      success: true,
      giveaways: enriched,
    });
  } catch (error) {
    console.error("GET /api/giveaways error:", error);
    return NextResponse.json({
      success: true,
      giveaways: getLocalGiveaways(),
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSupabaseServiceRoleKey();
    const anonKey = getSupabaseAnonKey();

    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    let userId = "guest-host";
    let userName = "CineRelay Member";
    let userEmail: string | null = null;

    if (token && supabaseUrl && (serviceKey || anonKey)) {
      try {
        const authClient = createClient(supabaseUrl, anonKey || "anon", {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData } = await authClient.auth.getUser();
        if (userData.user) {
          userId = userData.user.id;
          userEmail = userData.user.email ?? null;
          const meta = userData.user.user_metadata ?? {};
          userName = meta.full_name ?? meta.name ?? userData.user.email?.split("@")[0] ?? "CineRelay Member";
        }
      } catch {
        // Continue with default/guest
      }
    }

    let body: {
      title?: string;
      category?: string;
      prize_details?: string;
      prize_value?: number;
      venue?: string;
      movie_title?: string;
      tmdb_movie_id?: number;
      end_time?: string;
      winners_count?: number;
      claim_instructions?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const title = String(body.title ?? "").trim();
    const category = (body.category as "Movie Tickets" | "Gift Cards" | "Events") || "Movie Tickets";
    const prizeDetails = String(body.prize_details ?? "").trim();
    const prizeValue = Number(body.prize_value) || 0;
    const venue = String(body.venue ?? "").trim() || null;
    const movieTitle = String(body.movie_title ?? "").trim() || null;
    const tmdbMovieId = body.tmdb_movie_id ? Number(body.tmdb_movie_id) : null;
    const endTime = body.end_time ? new Date(body.end_time).toISOString() : new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    const winnersCount = Math.max(1, Math.min(5, Number(body.winners_count) || 1));
    const claimInstructions = String(body.claim_instructions ?? "").trim() || "Winner will be contacted via CineRelay chat.";

    if (!title) {
      return NextResponse.json(
        { error: "Giveaway title is required." },
        { status: 400 }
      );
    }

    if (!prizeDetails) {
      return NextResponse.json(
        { error: "Prize description is required." },
        { status: 400 }
      );
    }

    const newGiveaway: Giveaway = {
      id: `ga-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
      host_id: userId,
      host_name: userName,
      host_email: userEmail,
      title,
      category,
      prize_details: prizeDetails,
      prize_value: prizeValue,
      venue,
      movie_title: movieTitle,
      tmdb_movie_id: tmdbMovieId,
      end_time: endTime,
      winners_count: winnersCount,
      claim_instructions: claimInstructions,
      status: "active",
      winners: [],
      created_at: new Date().toISOString(),
      entries_count: 0,
      has_entered: false,
    };

    // Store in local store
    addLocalGiveaway(newGiveaway);

    // Try saving to Supabase if table is created
    if (supabaseUrl && serviceKey) {
      try {
        const dbClient = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        await dbClient.from("giveaways").insert({
          id: newGiveaway.id,
          host_id: newGiveaway.host_id,
          host_name: newGiveaway.host_name,
          host_email: newGiveaway.host_email,
          title: newGiveaway.title,
          category: newGiveaway.category,
          prize_details: newGiveaway.prize_details,
          prize_value: newGiveaway.prize_value,
          venue: newGiveaway.venue,
          movie_title: newGiveaway.movie_title,
          tmdb_movie_id: newGiveaway.tmdb_movie_id,
          end_time: newGiveaway.end_time,
          winners_count: newGiveaway.winners_count,
          claim_instructions: newGiveaway.claim_instructions,
          status: newGiveaway.status,
          winners: newGiveaway.winners,
        });
      } catch (dbErr) {
        console.warn("Could not insert giveaway into Supabase directly:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      giveaway: newGiveaway,
      message: "Giveaway contest hosted successfully!",
    });
  } catch (error) {
    console.error("POST /api/giveaways error:", error);
    return NextResponse.json(
      { error: "Could not create giveaway." },
      { status: 500 }
    );
  }
}
