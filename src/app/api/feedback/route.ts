import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseUrl,
  getSupabaseServiceRoleKey,
  getSupabaseAnonKey,
} from "@/lib/env";
import { addLocalFeedback, FeedbackCategory } from "@/lib/feedback-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, category, subject, message, page_url } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Please describe your concern or feedback." },
        { status: 400 }
      );
    }

    const validCategories: FeedbackCategory[] = [
      "bug",
      "ticket",
      "feature",
      "account",
      "feedback",
      "other",
    ];

    const cleanCategory: FeedbackCategory = validCategories.includes(category)
      ? category
      : "feedback";

    const userAgent = request.headers.get("user-agent") || "";

    // 1. Save to in-memory fallback store
    const saved = addLocalFeedback({
      name: name?.trim() || "Anonymous Cinephile",
      email: email?.trim() || "",
      category: cleanCategory,
      subject: subject?.trim() || "General Concern / Feedback",
      message: message.trim(),
      page_url: page_url || "",
      user_agent: userAgent,
    });

    // 2. Try inserting to Supabase if available
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSupabaseServiceRoleKey();
    const anonKey = getSupabaseAnonKey();

    if (supabaseUrl && (serviceKey || anonKey)) {
      try {
        const client = createClient(supabaseUrl, serviceKey || anonKey || "", {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        await client.from("feedback").insert([
          {
            ticket_id: saved.id,
            name: saved.name,
            email: saved.email,
            category: saved.category,
            subject: saved.subject,
            message: saved.message,
            page_url: saved.page_url,
            user_agent: saved.user_agent,
            created_at: saved.created_at,
            status: saved.status,
          },
        ]);
      } catch (dbErr) {
        // Table might not exist yet; fallback in-memory store succeeded
        console.warn("Supabase feedback insert note:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      id: saved.id,
      message:
        "Thank you! Your concern has been recorded. Our team will look into it promptly.",
      data: saved,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to submit feedback.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const { getLocalFeedback } = await import("@/lib/feedback-store");
  return NextResponse.json({
    concerns: getLocalFeedback(),
  });
}
