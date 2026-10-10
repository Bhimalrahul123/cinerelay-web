"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type ChatInfo = {
  id: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  listings: {
    title: string;
    category: string;
    price: number;
  } | null;
};

export default function ChatRoomPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;

  const [userId, setUserId] = useState("");
  const [chat, setChat] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("chat_messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (queryError) throw queryError;

    setMessages((data ?? []) as Message[]);
  }, [conversationId]);

  useEffect(() => {
    let active = true;

    async function initialiseChat() {
      try {
        setLoading(true);
        setError("");

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
          if (active) {
            setError("Please log in to access this conversation.");
          }
          return;
        }

        if (!active) return;
        setUserId(user.id);

        // RLS permits only conversation participants to read this row.
        const { data: conversation, error: chatError } = await supabase
          .from("chat_conversations")
          .select(`
            id,
            buyer_id,
            seller_id,
            listing_id,
            listings (
              title,
              category,
              price
            )
          `)
          .eq("id", conversationId)
          .maybeSingle();

        if (chatError) throw chatError;

        if (!conversation) {
          throw new Error(
            "Conversation not found, or you do not have access to it."
          );
        }

        if (!active) return;
        setChat(conversation as unknown as ChatInfo);

        await loadMessages();
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to open this conversation."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialiseChat();

    return () => {
      active = false;
    };
  }, [conversationId, loadMessages]);

  useEffect(() => {
    if (!chat) return;

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as Message;

          setMessages((current) => {
            if (current.some((message) => message.id === incoming.id)) {
              return current;
            }

            return [...current, incoming].sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            );
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chat, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const body = draft.trim();

    if (!body || !userId || !chat || sending) return;

    if (body.length > 4000) {
      setSendError("Messages cannot exceed 4,000 characters.");
      return;
    }

    setSending(true);
    setSendError("");

    try {
      const { data, error: insertError } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          body,
        })
        .select("id, conversation_id, sender_id, body, created_at")
        .single();

      if (insertError) throw insertError;

      const savedMessage = data as Message;

      setMessages((current) => {
        if (current.some((message) => message.id === savedMessage.id)) {
          return current;
        }

        return [...current, savedMessage].sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
        );
      });

      setDraft("");
    } catch (err) {
      setSendError(
        err instanceof Error
          ? err.message
          : "Message could not be sent. Please try again."
      );
    } finally {
      setSending(false);
    }
  }

  const otherPerson =
    chat && userId === chat.buyer_id ? "Seller" : "Buyer";

  return (
    <main className="flex min-h-screen flex-col bg-[#080b12] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-5">
          <Link href="/" className="text-xl font-black sm:text-2xl">
            <span className="text-amber-400">◈</span> CineRelay
          </Link>

          <Link
            href="/messages"
            className="text-sm text-gray-300 hover:text-amber-400"
          >
            ← All messages
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center p-8 text-gray-400">
          Loading conversation...
        </div>
      ) : error ? (
        <div className="mx-auto my-12 w-full max-w-xl px-5">
          <div
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6"
          >
            <h1 className="text-xl font-bold">Unable to open chat</h1>
            <p className="mt-3 break-words text-sm text-red-300">
              {error}
            </p>

            {error.includes("log in") && (
              <Link
                href="/auth?mode=login"
                className="mt-5 inline-block rounded-xl bg-amber-400 px-5 py-3 font-bold text-black"
              >
                Log in
              </Link>
            )}

            <Link
              href="/messages"
              className="ml-3 mt-5 inline-block text-amber-400"
            >
              Back to messages
            </Link>
          </div>
        </div>
      ) : chat ? (
        <>
          <section className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                Private conversation · {otherPerson}
              </p>

              <h1 className="mt-2 break-words text-xl font-black sm:text-2xl">
                {chat.listings?.title ?? "Ticket listing"}
              </h1>

              <p className="mt-2 text-sm text-gray-400">
                {chat.listings?.category ?? "Listing"}
                {chat.listings
                  ? ` · ₹${Number(chat.listings.price).toLocaleString("en-IN")}`
                  : ""}
              </p>

              <Link
                href={`/listing/${chat.listing_id}`}
                className="mt-3 inline-block text-sm font-semibold text-amber-400 hover:text-amber-300"
              >
                View ticket details →
              </Link>
            </div>
          </section>

          <section
            aria-label="Chat messages"
            className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-4 sm:px-5"
          >
            <div className="flex-1 space-y-4 rounded-2xl border border-white/10 bg-[#0d121c] p-4 sm:p-6">
              {messages.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center text-center">
                  <span className="text-5xl">💬</span>
                  <h2 className="mt-4 font-bold">Start the conversation</h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-gray-400">
                    Ask about ticket details, transfer eligibility,
                    or anything you need to clarify before proceeding.
                  </p>
                </div>
              ) : (
                messages.map((message) => {
                  const mine = message.sender_id === userId;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] break-words rounded-2xl px-4 py-3 sm:max-w-[75%] ${
                          mine
                            ? "rounded-br-sm bg-amber-400 text-black"
                            : "rounded-bl-sm border border-white/10 bg-[#171e2b] text-white"
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-6">
                          {message.body}
                        </p>

                        <p
                          className={`mt-2 text-right text-[10px] ${
                            mine ? "text-black/60" : "text-gray-500"
                          }`}
                        >
                          {new Date(message.created_at).toLocaleString(
                            "en-IN",
                            {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}

              <div ref={bottomRef} />
            </div>

            {sendError && (
              <p role="alert" className="mt-3 text-sm text-red-300">
                {sendError}
              </p>
            )}

            <form
              onSubmit={sendMessage}
              className="mt-4 flex items-end gap-3"
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                maxLength={4000}
                rows={2}
                placeholder="Write your message..."
                aria-label="Write your message"
                className="min-h-12 flex-1 resize-y rounded-2xl border border-white/10 bg-[#111722] px-4 py-3 text-sm outline-none focus:border-amber-400"
              />

              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className="rounded-2xl bg-amber-400 px-5 py-3 font-bold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </form>

            <p className="mt-3 text-xs leading-5 text-gray-500">
              Confirm the issuer's transfer rules before paying.
              Never share passwords or verification codes in chat.
            </p>
          </section>
        </>
      ) : null}

      <footer className="border-t border-white/10 px-5 py-5 text-center text-xs text-gray-500">
        © 2026 CineRelay. All rights reserved.
      </footer>
    </main>
  );
}