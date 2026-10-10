
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function MessageNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadNotifications() {
      // Remove the previous channel before creating another one.
      if (channel) {
        await supabase.removeChannel(channel);
        channel = null;
      }

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !user) {
        setUnreadCount(0);
        return;
      }

      const userId = user.id;

      async function refreshCount() {
        const { count, error: countError } = await supabase
          .from("chat_notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", userId)
          .is("read_at", null);

        if (active && !countError) {
          setUnreadCount(count ?? 0);
        }
      }

      await refreshCount();

      if (!active) return;

      channel = supabase
        .channel(`message-notifications-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chat_notifications",
            filter: `recipient_id=eq.${userId}`,
          },
          () => {
            void refreshCount();
          }
        )
        .subscribe();
    }

    void loadNotifications();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadNotifications();
    });

    return () => {
      active = false;
      subscription.unsubscribe();

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  return (
    <Link
      href="/messages"
      className="inline-flex items-center gap-2 text-gray-300 transition hover:text-amber-400"
    >
      <span>Messages</span>

      {unreadCount > 0 && (
        <span
          aria-label={`${unreadCount} unread messages`}
          className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-black"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
