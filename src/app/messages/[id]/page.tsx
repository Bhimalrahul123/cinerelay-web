
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Conversation = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
};

type Listing = {
  title: string;
  category: string;
  price: number;
};

type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(price));
}

function formatMessageTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();

  const rawId = params?.id;
  const conversationId = typeof rawId === "string" ? rawId : "";

  const [userId, setUserId] = useState("");
  const [conversation, setConversation] =
    useState<Conversation | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadMessages = useCallback(async () => {
    if (!conversationId) {
      throw new Error("Conversation ID is missing from the URL.");
    }

    const { data, error: queryError } = await supabase
      .from("chat_messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (queryError) throw queryError;

    setMessages((data ?? []) as ChatMessage[]);
  }, [conversationId]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        setLoading(true);
        setError("");

        if (!conversationId) {
          throw new Error(
            "Conversation ID is missing. Open this chat from the Messages page."
          );
        }

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
          router.replace(
            `/auth?mode=login&next=${encodeURIComponent(
              `/messages/${conversationId}`
            )}`
          );
          return;
        }

        if (cancelled) return;
        setUserId(user.id);

        const { data: chat, error: chatError } = await supabase
          .from("chat_conversations")
          .select("id, listing_id, buyer_id, seller_id, created_at")
          .eq("id", conversationId)
          .maybeSingle();

        if (chatError) throw chatError;

        if (!chat) {
          throw new Error(
            "Conversation not found or access is denied. Open Messages and select a valid conversation."
          );
        }

        const currentChat = chat as Conversation;

        if (
          currentChat.buyer_id !== user.id &&
          currentChat.seller_id !== user.id
        ) {
          throw new Error(
            "Your account is not a participant in this conversation."
          );
        }

        if (cancelled) return;
        setConversation(currentChat);

        const { data: item, error: listingError } = await supabase
          .from("listings")
          .select("title, category, price")
          .eq("id", currentChat.listing_id)
          .maybeSingle();

        if (listingError) throw listingError;

        if (cancelled) return;
        setListing(item as Listing | null);

        await loadMessages();
      } catch (err) {
        console.error("[CineRelay Chat] Initialization failed:", err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load this conversation."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [conversationId, loadMessages, router]);

  useEffect(() => {
    if (!conversation || !userId) return;

    const channel = supabase
      .channel(`conversation-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const incoming = payload.new as ChatMessage;

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
  }, [conversation, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = draft.trim();

    if (!body || !conversation || !userId || sending) return;

    if (body.length > 2000) {
      setError("Messages cannot exceed 2,000 characters.");
      return;
    }

    try {
      setSending(true);
      setError("");

      const { data, error: insertError } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: userId,
          body,
        })
        .select("id, conversation_id, sender_id, body, created_at")
        .single();

      if (insertError) throw insertError;

      const newMessage = data as ChatMessage;

      setMessages((current) => {
        if (current.some((message) => message.id === newMessage.id)) {
          return current;
        }

        return [...current, newMessage].sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
        );
      });

      setDraft("");

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (err) {
      console.error("[CineRelay Chat] Send failed:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to send your message."
      );
    } finally {
      setSending(false);
    }
  }

  const isBuyer = conversation?.buyer_id === userId;

  return (
    <main className="min-h-screen bg-[#090a0c] text-[#f5f2eb]">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#090a0c]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d6b36a]/30 bg-[#d6b36a]/[0.08] text-xl text-[#e5ca91]">
              ◈
            </span>

            <span className="text-lg font-semibold tracking-[-0.04em] sm:text-xl">
              Cine<span className="font-light text-[#d6b36a]">Relay</span>
            </span>
          </Link>

          <Link
            href="/messages"
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/65 transition hover:border-[#d6b36a]/40 hover:text-[#e5ca91]"
          >
            <span aria-hidden="true">← </span>
            All messages
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
        <div className="mb-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d6b36a]/25 bg-[#d6b36a]/[0.06] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e5ca91]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d6b36a]" />
            Private conversation
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="break-words text-3xl font-semibold tracking-[-0.05em] text-[#fffaf0] sm:text-4xl">
                {listing?.title ?? "Your conversation"}
                <span className="text-[#d6b36a]">.</span>
              </h1>

              <p className="mt-3 text-sm leading-6 text-white/50">
                Discuss the details directly with the other participant.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 py-1.5 text-xs text-white/60">
                  {listing?.category ?? "Ticket listing"}
                </span>

                {conversation && (
                  <span className="rounded-lg border border-[#d6b36a]/20 bg-[#d6b36a]/[0.06] px-3 py-1.5 text-xs text-[#e5ca91]">
                    {isBuyer ? "You're chatting with the seller" : "You're chatting with the buyer"}
                  </span>
                )}
              </div>
            </div>

            {listing && (
              <div className="shrink-0 rounded-2xl border border-[#d6b36a]/20 bg-[#d6b36a]/[0.05] px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                  Listing price
                </p>
                <p className="mt-1 text-xl font-semibold text-[#e5ca91]">
                  {formatPrice(Number(listing.price))}
                </p>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8">
            <div
              className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-[#d6b36a]"
              aria-label="Loading conversation"
            />
            <p className="mt-5 text-sm text-white/50">
              Preparing your conversation...
            </p>
          </div>
        ) : error && !conversation ? (
          <div
            role="alert"
            className="rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-6 sm:p-9"
          >
            <span className="text-2xl text-red-200">!</span>

            <h2 className="mt-3 text-xl font-semibold text-[#fffaf0]">
              Unable to open this conversation
            </h2>

            <p className="mt-3 break-words text-sm leading-6 text-red-100/70">
              {error}
            </p>

            <Link href="/messages" className="premium-button mt-5">
              Back to messages
            </Link>
          </div>
        ) : conversation ? (
          <div className="overflow-hidden rounded-3xl border border-white/[0.09] bg-[#101114] shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] bg-white/[0.015] px-4 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d6b36a]/25 bg-[#d6b36a]/[0.07] text-lg text-[#e5ca91]">
                  ◇
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#fffaf0]">
                    {isBuyer ? "Seller" : "Buyer"}
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    Ticket discussion
                  </p>
                </div>
              </div>

              <span className="flex shrink-0 items-center gap-2 text-xs text-white/40">
                <span className="h-1.5 w-1.5 rounded-full bg-[#d6b36a]" />
                Private chat
              </span>
            </div>

            <div className="flex min-h-[320px] max-h-[58vh] flex-col gap-5 overflow-y-auto p-4 sm:min-h-[400px] sm:p-6">
              {messages.length === 0 ? (
                <div className="m-auto max-w-sm py-12 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#d6b36a]/25 bg-[#d6b36a]/[0.06] text-3xl text-[#e5ca91]">
                    ◇
                  </div>

                  <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d6b36a]">
                    A fresh start
                  </p>

                  <h2 className="mt-2 text-xl font-semibold text-[#fffaf0]">
                    Start the conversation
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-white/45">
                    Ask about ticket details, transfer eligibility, or anything
                    you need to clarify before proceeding.
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
                        className={`max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[75%] ${
                          mine
                            ? "rounded-br-sm border border-[#d6b36a]/30 bg-gradient-to-br from-[#e8cb8c] to-[#c6a45c] text-[#17130b]"
                            : "rounded-bl-sm border border-white/[0.09] bg-[#191a1e] text-[#f5f2eb]"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm leading-6">
                          {message.body}
                        </p>

                        <p
                          className={`mt-2 text-right text-[10px] ${
                            mine ? "text-black/55" : "text-white/35"
                          }`}
                        >
                          {formatMessageTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}

              <div ref={bottomRef} />
            </div>

            {error && (
              <div
                role="alert"
                className="mx-4 mb-3 rounded-xl border border-red-400/20 bg-red-400/[0.05] px-4 py-3 text-sm text-red-200/80 sm:mx-6"
              >
                {error}
              </div>
            )}

            <form
              onSubmit={sendMessage}
              className="border-t border-white/[0.08] bg-[#0c0d0f] p-3 sm:p-5"
            >
              <label htmlFor="chat-message" className="sr-only">
                Write a message
              </label>

              <div className="rounded-2xl border border-white/[0.1] bg-[#141518] p-2 transition focus-within:border-[#d6b36a]/40">
                <textarea
                  ref={textareaRef}
                  id="chat-message"
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setError("");

                    const textarea = event.target;
                    textarea.style.height = "auto";
                    textarea.style.height = `${Math.min(
                      textarea.scrollHeight,
                      160
                    )}px`;
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="Write your message..."
                  rows={2}
                  maxLength={2000}
                  disabled={sending}
                  className="max-h-40 min-h-12 w-full resize-none bg-transparent px-3 py-3 text-sm leading-6 text-[#f5f2eb] outline-none placeholder:text-white/30 disabled:opacity-50"
                />

                <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-2 pt-3">
                  <div className="min-w-0">
                    <p className="text-[10px] text-white/35">
                      Enter to send · Shift + Enter for a new line
                    </p>
                    <p
                      className={`mt-1 text-[10px] ${
                        draft.length > 1800
                          ? "text-[#e5ca91]"
                          : "text-white/25"
                      }`}
                    >
                      {draft.length}/2000 characters
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={!draft.trim() || sending}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e8cb8c] to-[#c6a45c] px-5 py-3 text-sm font-semibold text-[#17130b] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {sending ? "Sending..." : "Send"}
                    {!sending && <span aria-hidden="true">↗</span>}
                  </button>
                </div>
              </div>

              <p className="mt-3 px-1 text-center text-[10px] leading-5 text-white/30">
                Keep your ticket discussions on CineRelay. Never share
                passwords or verification codes.
              </p>
            </form>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.08] p-8 text-center text-sm text-white/45">
            Conversation could not be loaded.
          </div>
        )}
      </section>

      <footer className="mt-8 border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-7 text-xs text-white/35 sm:px-6 lg:px-8">
          <Link href="/" className="font-semibold text-white/70">
            Cine<span className="font-light text-[#d6b36a]">Relay</span>
          </Link>

          <p>© 2026 CineRelay. All rights reserved.</p>

          <Link
            href="/messages"
            className="transition hover:text-[#e5ca91]"
          >
            All messages →
          </Link>
        </div>
      </footer>
    </main>
  );
}
