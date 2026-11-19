"use client";

import { useState } from "react";
import Link from "next/link";
import { RaiseConcernModal } from "./RaiseConcernModal";

export function InstagramIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export function Footer() {
  const [showConcernModal, setShowConcernModal] = useState(false);

  return (
    <>
      <footer className="border-t border-white/[0.08] bg-black/40 backdrop-blur-sm">
        <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1.2fr_1fr]">
            {/* BRAND */}
            <div>
              <Link href="/" className="inline-flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#d6b36a]/30 bg-[#d6b36a]/15 text-lg font-bold text-[#e5ca91]">
                  ◈
                </span>
                <span className="text-xl font-bold tracking-[-0.05em] text-white">
                  Cine<span className="text-[#d6b36a]">Relay</span>
                </span>
              </Link>

              <p className="mt-4 max-w-xs text-sm leading-7 text-white/60">
                Discover new experiences. Connect with ticket holders. Give
                unused tickets another chance.
              </p>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => setShowConcernModal(true)}
                  className="group inline-flex items-center gap-2 rounded-xl border border-[#d6b36a]/30 bg-[#d6b36a]/10 px-3.5 py-2 text-xs font-semibold text-[#f0dcae] transition hover:border-[#d6b36a] hover:bg-[#d6b36a]/20"
                >
                  <span className="text-sm">⚠️</span>
                  <span>Raise a Concern / App Feedback</span>
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </button>
              </div>
            </div>

            {/* EXPLORE */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0dcae]">
                Explore
              </h3>
              <div className="mt-4 flex flex-col gap-3 text-sm text-white/65">
                <Link href="/#marketplace" className="hover:text-white transition">
                  Browse tickets
                </Link>
                <Link href="/giveaways" className="hover:text-white transition">
                  Giveaways & Contests
                </Link>
                <Link href="/sell" className="hover:text-white transition">
                  Sell a ticket
                </Link>
                <Link href="/my-listings" className="hover:text-white transition">
                  My listings
                </Link>
              </div>
            </div>

            {/* DISCOVER US */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0dcae]">
                Discover Us
              </h3>
              <div className="mt-4 flex flex-col gap-3.5 text-sm text-white/65">
                {/* Official Instagram Link */}
                <a
                  href="https://www.instagram.com/cinerelay?gwpx=OWluMHJoNm81dmVj"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-2.5 transition hover:border-[#d6b36a]/40 hover:bg-[#d6b36a]/[0.08]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white shadow-md transition group-hover:scale-105">
                    <InstagramIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white transition group-hover:text-[#f0dcae]">
                      CineRelay (@cinerelay)
                    </p>
                    <p className="text-[11px] text-white/50">Follow on Instagram ↗</p>
                  </div>
                </a>

                <Link href="/profile" className="hover:text-white transition">
                  My profile
                </Link>
                <Link href="/messages" className="hover:text-white transition">
                  Messages
                </Link>
              </div>
            </div>

            {/* SUPPORT & CONCERNS */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0dcae]">
                Support & Legal
              </h3>
              <div className="mt-4 flex flex-col gap-3 text-sm text-white/65">
                <button
                  type="button"
                  onClick={() => setShowConcernModal(true)}
                  className="text-left text-[#f0dcae] hover:underline"
                >
                  Raise Concerns & Feedback
                </button>
                <Link href="/feedback" className="hover:text-white transition">
                  Report App Problem
                </Link>
                <a href="mailto:support@cinerelay.com" className="hover:text-white transition">
                  Contact support
                </a>
                <Link href="/terms" className="hover:text-white transition">
                  Terms
                </Link>
                <Link href="/privacy" className="hover:text-white transition">
                  Privacy
                </Link>
              </div>
            </div>
          </div>

          {/* BOTTOM COPYRIGHT BAR */}
          <div className="mt-10 flex flex-col gap-3 border-t border-white/[0.08] pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} CineRelay. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a
                href="https://www.instagram.com/cinerelay?gwpx=OWluMHJoNm81dmVj"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-white/60 transition hover:text-[#f0dcae]"
              >
                <InstagramIcon className="h-3.5 w-3.5 text-[#ee2a7b]" />
                <span>@cinerelay</span>
              </a>
              <span>•</span>
              <p>Discover. Connect. Relay.</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Interactive Raise Concern / Feedback Modal */}
      <RaiseConcernModal
        isOpen={showConcernModal}
        onClose={() => setShowConcernModal(false)}
      />
    </>
  );
}

export default Footer;
