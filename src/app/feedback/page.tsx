"use client";

import { useState } from "react";
import Link from "next/link";
import { Footer, InstagramIcon } from "@/components/Footer";
import { FeedbackCategory } from "@/lib/feedback-store";

const CATEGORIES: {
  id: FeedbackCategory;
  label: string;
  icon: string;
  desc: string;
}[] = [
  {
    id: "bug",
    label: "App Bug / Technical Problem",
    icon: "🐛",
    desc: "Something is broken, not loading, or malfunctioning",
  },
  {
    id: "ticket",
    label: "Ticket or Listing Concern",
    icon: "🎟️",
    desc: "Issues with showtime, transfer, or seller/buyer listing",
  },
  {
    id: "feature",
    label: "Feature Request / Suggestion",
    icon: "💡",
    desc: "Ideas you want to see built into CineRelay",
  },
  {
    id: "feedback",
    label: "General Platform Feedback",
    icon: "💬",
    desc: "Share your experience or compliments",
  },
];

export default function FeedbackPage() {
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!message.trim()) {
      setError("Please describe your concern or feedback in detail.");
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

      setSubmittedId(data.id || "CR-C" + Math.floor(100000 + Math.random() * 900000));
      setSubject("");
      setMessage("");
    } catch {
      setError("Network error while submitting. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setSubmittedId(null);
    setSubject("");
    setMessage("");
    setError("");
  }

  return (
    <main className="min-h-screen bg-[#090a0c] text-[#f5f2eb]">
      {/* Atmosphere glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute left-[30%] top-[-200px] h-[650px] w-[850px] rounded-full bg-[#d6b36a]/[0.08] blur-[150px]" />
        <div className="absolute right-[-150px] top-[20%] h-[500px] w-[500px] rounded-full bg-violet-900/[0.06] blur-[130px]" />
      </div>

      {/* TOP HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#090a0c]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-5 py-4 sm:px-8 lg:px-12">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d6b36a]/30 bg-[#d6b36a]/[0.08] text-xl text-[#e5ca91]">
              ◈
            </span>
            <span className="text-xl font-bold tracking-[-0.06em] sm:text-2xl">
              Cine<span className="text-[#d6b36a]">Relay</span>
            </span>
          </Link>

          <nav className="flex items-center gap-4 text-xs sm:gap-6 sm:text-sm">
            <Link
              href="/"
              className="text-white/75 transition hover:text-[#f0dcae]"
            >
              Explore
            </Link>
            <Link
              href="/giveaways"
              className="text-white/75 transition hover:text-[#f0dcae]"
            >
              Giveaways
            </Link>
            <a
              href="https://www.instagram.com/cinerelay?gwpx=OWluMHJoNm81dmVj"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/80 transition hover:border-[#ee2a7b]/40 hover:text-white"
            >
              <InstagramIcon className="h-3.5 w-3.5 text-[#ee2a7b]" />
              <span className="hidden sm:inline">Instagram</span>
            </a>
          </nav>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="text-center">
          <span className="inline-block rounded-full border border-[#d6b36a]/30 bg-[#d6b36a]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#f0dcae]">
            Help & User Feedback
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Raise a Concern or Feedback
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
            Encountered any problem in CineRelay, have questions about a ticket, or want to suggest new features? Let our team know below.
          </p>
        </div>

        {/* QUICK CONTACT CHANNELS */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {/* Instagram Card */}
          <a
            href="https://www.instagram.com/cinerelay?gwpx=OWluMHJoNm81dmVj"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-[#ee2a7b]/40 hover:bg-[#ee2a7b]/[0.04]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white shadow-lg transition group-hover:scale-105">
              <InstagramIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <span className="text-xs uppercase tracking-wider text-white/40">
                Discover Us On Instagram
              </span>
              <p className="text-sm font-bold text-white group-hover:text-[#f0dcae]">
                CineRelay (@cinerelay) ↗
              </p>
              <p className="text-xs text-white/50">DM or follow for community drops</p>
            </div>
          </a>

          {/* Email Support */}
          <a
            href="mailto:support@cinerelay.com"
            className="group flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-[#d6b36a]/40 hover:bg-[#d6b36a]/[0.04]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#d6b36a]/30 bg-[#d6b36a]/15 text-xl text-[#f0dcae] shadow-lg transition group-hover:scale-105">
              ✉
            </div>
            <div className="min-w-0">
              <span className="text-xs uppercase tracking-wider text-white/40">
                Direct Email Support
              </span>
              <p className="text-sm font-bold text-white group-hover:text-[#f0dcae]">
                support@cinerelay.com ↗
              </p>
              <p className="text-xs text-white/50">Fast response from our operations desk</p>
            </div>
          </a>
        </div>

        {/* FEEDBACK FORM CARD */}
        <div className="mt-8 rounded-3xl border border-white/10 bg-[#111317] p-6 shadow-2xl sm:p-10">
          {submittedId ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-3xl text-emerald-400">
                ✓
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Concern Registered Successfully!
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-white/70">
                Thank you for bringing this to our attention. Our team reviews submissions continuously to ensure CineRelay stays reliable.
              </p>
              <div className="mx-auto mt-6 max-w-xs rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <span className="text-xs uppercase tracking-wider text-white/45">
                  Reference Ticket Number
                </span>
                <p className="mt-1 font-mono text-xl font-bold text-[#f0dcae]">
                  #{submittedId}
                </p>
              </div>
              <div className="mt-8 flex justify-center gap-4">
                <Link
                  href="/"
                  className="rounded-xl bg-[#d6b36a] px-6 py-3 text-sm font-bold text-black transition hover:bg-[#e5ca91]"
                >
                  Return to Home
                </Link>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Submit Another Note
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Category */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/70">
                  Select Concern Type *
                </label>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {CATEGORIES.map((cat) => {
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition ${
                          isSelected
                            ? "border-[#d6b36a] bg-[#d6b36a]/15 text-[#f0dcae]"
                            : "border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20 hover:bg-white/[0.04]"
                        }`}
                      >
                        <span className="text-xl">{cat.icon}</span>
                        <span className="text-sm font-semibold">{cat.label}</span>
                        <span className="text-xs text-white/50">{cat.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label
                  htmlFor="page-concern-subject"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/70"
                >
                  Subject / Summary (Optional)
                </label>
                <input
                  id="page-concern-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Can't see contest entries or listing error"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#d6b36a] focus:bg-white/[0.05]"
                />
              </div>

              {/* Detailed Explanation */}
              <div>
                <label
                  htmlFor="page-concern-details"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/70"
                >
                  Explain the Issue or Share Your Feedback *
                </label>
                <textarea
                  id="page-concern-details"
                  rows={5}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please provide details about what went wrong, which page or ticket you were looking at, or what features you'd like to see..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#d6b36a] focus:bg-white/[0.05]"
                />
              </div>

              {/* Contact Information */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="page-concern-name"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/70"
                  >
                    Your Name (Optional)
                  </label>
                  <input
                    id="page-concern-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#d6b36a]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="page-concern-email"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/70"
                  >
                    Your Email (Optional, for resolution reply)
                  </label>
                  <input
                    id="page-concern-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#d6b36a]"
                  />
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-500/25 bg-red-500/10 p-3.5 text-xs text-red-200"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d6b36a] to-[#ebce8e] py-4 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                    <span>Submitting Your Concern...</span>
                  </>
                ) : (
                  <span>Submit Concern / Feedback 🚀</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <Footer />
    </main>
  );
}
