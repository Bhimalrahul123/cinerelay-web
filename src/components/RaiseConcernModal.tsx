"use client";

import { useState, useEffect } from "react";
import { FeedbackCategory } from "@/lib/feedback-store";

interface RaiseConcernModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: FeedbackCategory;
}

const CATEGORIES: {
  id: FeedbackCategory;
  label: string;
  icon: string;
  desc: string;
}[] = [
  {
    id: "bug",
    label: "App Bug / Problem",
    icon: "🐛",
    desc: "Something is broken, not loading, or crashing",
  },
  {
    id: "ticket",
    label: "Ticket / Listing Concern",
    icon: "🎟️",
    desc: "Issue with a movie ticket, voucher, or listing",
  },
  {
    id: "feature",
    label: "Feature Request / Idea",
    icon: "💡",
    desc: "Suggest an improvement or new feature",
  },
  {
    id: "feedback",
    label: "General Feedback",
    icon: "💬",
    desc: "Share your thoughts or compliments",
  },
];

export function RaiseConcernModal({
  isOpen,
  onClose,
  initialCategory = "bug",
}: RaiseConcernModalProps) {
  const [category, setCategory] = useState<FeedbackCategory>(initialCategory);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTicketId(null);
      setError("");
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!message.trim()) {
      setError("Please describe the concern or problem in the details field.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subject: subject.trim() || undefined,
          message: message.trim(),
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          page_url: typeof window !== "undefined" ? window.location.href : "",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit. Please try again.");
        return;
      }

      setTicketId(data.id || "CR-C" + Math.floor(100000 + Math.random() * 900000));
      setSubject("");
      setMessage("");
    } catch {
      setError("Network error while submitting. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setTicketId(null);
    setSubject("");
    setMessage("");
    setError("");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="raise-concern-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#0f1115] p-6 shadow-2xl text-white sm:p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>

        {ticketId ? (
          /* SUCCESS CONFIRMATION STATE */
          <div className="py-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-3xl">
              ✓
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d6b36a]">
              Concern Logged
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Thank you for letting us know!
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm text-white/70">
              Your report has been securely registered with our support team. We take every issue seriously to ensure a smooth experience for all cinephiles.
            </p>

            <div className="mx-auto mt-6 max-w-xs rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <span className="text-[11px] uppercase tracking-wider text-white/45">
                Reference ID
              </span>
              <p className="mt-0.5 font-mono text-lg font-bold text-[#f0dcae]">
                #{ticketId}
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-[#d6b36a] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#e5ca91]"
              >
                Done
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Submit another report
              </button>
            </div>
          </div>
        ) : (
          /* FORM SUBMISSION STATE */
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <span className="inline-block rounded-full border border-[#d6b36a]/30 bg-[#d6b36a]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f0dcae]">
                Support & Feedback
              </span>
              <h2
                id="raise-concern-title"
                className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl text-white"
              >
                Raise Concerns & Feedback
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-white/60">
                Experiencing any problem with the app, ticket delivery, or have a suggestion? Let us know below.
              </p>
            </div>

            {/* Category Selector */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/70">
                What is this about? *
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? "border-[#d6b36a] bg-[#d6b36a]/15 text-[#f0dcae]"
                          : "border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20 hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="text-lg">{cat.icon}</span>
                      <span className="text-xs font-semibold">{cat.label}</span>
                      <span className="text-[10px] leading-tight text-white/50 line-clamp-1">
                        {cat.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label
                htmlFor="concern-subject"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/70"
              >
                Subject / Issue Title (Optional)
              </label>
              <input
                id="concern-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Page not loading properly / Bug in countdown"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#d6b36a] focus:bg-white/[0.05]"
              />
            </div>

            {/* Detailed Description */}
            <div>
              <label
                htmlFor="concern-message"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/70"
              >
                Details / What happened? *
              </label>
              <textarea
                id="concern-message"
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe what went wrong, which button you clicked, or your feature suggestion in detail..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#d6b36a] focus:bg-white/[0.05]"
              />
            </div>

            {/* User Info (Optional) */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="concern-name"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/70"
                >
                  Your Name (Optional)
                </label>
                <input
                  id="concern-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#d6b36a]"
                />
              </div>

              <div>
                <label
                  htmlFor="concern-email"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/70"
                >
                  Email for reply (Optional)
                </label>
                <input
                  id="concern-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#d6b36a]"
                />
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200"
              >
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2.5 text-xs font-semibold text-white/60 transition hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#d6b36a] to-[#ebce8e] px-6 py-2.5 text-xs font-bold text-black transition hover:brightness-110 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit Concern 🚀</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
export default RaiseConcernModal;
