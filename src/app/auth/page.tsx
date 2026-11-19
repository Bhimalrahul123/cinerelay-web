
"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [authMethod, setAuthMethod] = useState<"otp" | "password">("otp");

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Status & loading
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Countdown timer for resending OTP
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  function getSafeRedirect(): string {
    const next = searchParams.get("next");
    return next && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/profile";
  }

  function changeMode(nextMode: "login" | "signup") {
    setMessage("");
    setError("");
    setPassword("");
    setOtpSent(false);
    setOtpCode("");
    router.replace(`/auth?mode=${nextMode}`, { scroll: false });
  }

  // 1. Send OTP to Gmail / Email
  async function handleSendOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid Gmail / email address.");
      return;
    }

    setLoading(true);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true, // Auto-signs up new user or logs in existing user
        },
      });

      if (otpError) throw otpError;

      setOtpSent(true);
      setCooldown(60);
      setMessage(
        `📩 6-digit OTP code sent to ${cleanEmail}! Please check your Gmail inbox and spam folder.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send OTP to Gmail. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // 2. Verify 6-digit OTP code
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();
    const token = otpCode.trim();

    if (!token || token.length < 6) {
      setError("Please enter the complete 6-digit verification code from your Gmail.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token,
        type: "email",
      });

      if (verifyError) throw verifyError;

      if (data.session) {
        setMessage("✓ Verification successful! Redirecting...");
        const target = getSafeRedirect();
        router.replace(target);
        router.refresh();
      } else {
        throw new Error("Unable to establish session. Please try again.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Invalid or expired OTP code. Please check your Gmail or request a new code."
      );
    } finally {
      setLoading(false);
    }
  }

  // 3. Password login/signup fallback
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError("Please enter your email address and password.");
      return;
    }

    if (mode === "signup" && password.length < 6) {
      setError("Your password must contain at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (signupError) throw signupError;

        if (data.session) {
          router.replace(getSafeRedirect());
          router.refresh();
          return;
        }

        setMessage(
          "Account created. Check your Gmail for a confirmation link before signing in."
        );
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (loginError) throw loginError;

        router.replace(getSafeRedirect());
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Authentication failed. Please check credentials and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090a0c] px-5 py-12 text-[#f5f2eb]">
      {/* Cinematic background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute left-1/2 top-[-220px] h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[#d6b36a]/[0.11] blur-[130px]" />

        <div className="absolute bottom-[-180px] left-[-120px] h-[380px] w-[380px] rounded-full bg-[#8060a8]/[0.07] blur-[120px]" />

        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />
      </div>

      <div className="relative w-full max-w-[460px]">
        {/* Brand */}
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-3"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#f4dfac] to-[#bd9345] text-lg font-black text-[#111111] shadow-[0_0_25px_rgba(214,179,106,0.15)]">
            C
          </span>

          <span className="text-2xl font-bold tracking-[-0.06em]">
            Cine<span className="text-[#d6b36a]">Relay</span>
          </span>
        </Link>

        {/* Authentication card */}
        <section className="rounded-[28px] border border-white/[0.12] bg-[#111317]/90 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.4)] backdrop-blur-2xl sm:p-9">
          <div className="mb-7">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d6b36a]/25 bg-[#d6b36a]/[0.07] px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#d6b36a]" />

              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f0dcae]">
                Welcome to CineRelay
              </span>
            </div>

            <h1 className="text-3xl font-semibold tracking-[-0.055em] text-[#fffaf0]">
              {mode === "login" ? "Welcome back." : "Join CineRelay."}
            </h1>

            <p className="mt-2 text-sm leading-6 text-white/65">
              {authMethod === "otp"
                ? "Sign in securely with a 6-digit OTP code sent directly to your Gmail."
                : mode === "login"
                ? "Sign in with your email and password."
                : "Create your CineRelay account."}
            </p>
          </div>

          {/* Authentication Method Selector */}
          <div className="mb-6 grid grid-cols-2 rounded-xl border border-white/[0.08] bg-black/25 p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setAuthMethod("otp");
                setError("");
                setMessage("");
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 font-semibold transition ${
                authMethod === "otp"
                  ? "bg-[#d6b36a] text-[#111111] shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <span>✉️</span>
              <span>Gmail OTP</span>
              <span className="rounded bg-black/20 px-1 py-0.2 text-[9px] font-bold">Fast</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMethod("password");
                setError("");
                setMessage("");
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 font-semibold transition ${
                authMethod === "password"
                  ? "bg-[#d6b36a] text-[#111111] shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <span>🔑</span>
              <span>Password</span>
            </button>
          </div>

          {/* GMAIL OTP FLOW */}
          {authMethod === "otp" ? (
            !otpSent ? (
              /* Step 1: Request OTP to Gmail */
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label
                    htmlFor="email-otp"
                    className="mb-2 block text-sm font-medium text-white/85"
                  >
                    Your Gmail / Email address
                  </label>

                  <input
                    id="email-otp"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. rahul@gmail.com"
                    className="w-full rounded-xl border border-white/[0.12] bg-[#090b10] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#d6b36a]/65 focus:ring-2 focus:ring-[#d6b36a]/10"
                    autoFocus
                  />
                  <p className="mt-2 text-xs text-white/50">
                    We will send a 6-digit one-time verification code directly to this address.
                  </p>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-400/25 bg-red-400/[0.08] px-4 py-3 text-sm leading-6 text-red-200"
                  >
                    {error}
                  </div>
                )}

                {message && (
                  <div
                    role="status"
                    className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.08] px-4 py-3 text-sm leading-6 text-emerald-200"
                  >
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d6b36a] to-[#ebce8e] px-5 py-4 text-sm font-bold text-[#111111] shadow-lg shadow-[#d6b36a]/[0.08] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Sending OTP to Gmail..." : "Send OTP to Gmail ✉️"}
                  {!loading && (
                    <span className="transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  )}
                </button>
              </form>
            ) : (
              /* Step 2: Enter 6-digit OTP code */
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">
                      Code sent to: <strong className="text-[#f5dfb0]">{email}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode("");
                        setError("");
                      }}
                      className="text-[11px] font-semibold text-[#d6b36a] hover:underline"
                    >
                      Change
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="otp-code"
                    className="mb-2 block text-sm font-medium text-white/85 text-center"
                  >
                    Enter 6-Digit OTP Code
                  </label>

                  <input
                    id="otp-code"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="123456"
                    className="w-full rounded-xl border border-white/[0.14] bg-[#090b10] px-4 py-3.5 text-center font-mono text-2xl font-bold tracking-[0.35em] text-[#fffaf0] outline-none transition placeholder:text-white/20 focus:border-[#d6b36a] focus:ring-2 focus:ring-[#d6b36a]/15"
                    autoFocus
                  />
                  <p className="mt-2 text-center text-xs text-white/50">
                    Check your Gmail inbox or spam folder for the code.
                  </p>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-400/25 bg-red-400/[0.08] px-4 py-3 text-sm leading-6 text-red-200"
                  >
                    {error}
                  </div>
                )}

                {message && (
                  <div
                    role="status"
                    className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.08] px-4 py-3 text-sm leading-6 text-emerald-200"
                  >
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || otpCode.length < 6}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d6b36a] to-[#ebce8e] px-5 py-4 text-sm font-bold text-[#111111] shadow-lg shadow-[#d6b36a]/[0.08] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Verifying code..." : "Verify & Sign In 🚀"}
                  {!loading && (
                    <span className="transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  )}
                </button>

                {/* Resend OTP button */}
                <div className="pt-2 text-center text-xs text-white/60">
                  {cooldown > 0 ? (
                    <span>Resend OTP code in <strong className="text-white">{cooldown}s</strong></span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendOtp()}
                      disabled={loading}
                      className="font-semibold text-[#d6b36a] hover:underline"
                    >
                      Resend OTP to Gmail
                    </button>
                  )}
                </div>
              </form>
            )
          ) : (
            /* PASSWORD FLOW */
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email-pwd"
                  className="mb-2 block text-sm font-medium text-white/85"
                >
                  Email address
                </label>

                <input
                  id="email-pwd"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-white/[0.12] bg-[#090b10] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#d6b36a]/65 focus:ring-2 focus:ring-[#d6b36a]/10"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-white/85"
                >
                  Password
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-xl border border-white/[0.12] bg-[#090b10] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#d6b36a]/65 focus:ring-2 focus:ring-[#d6b36a]/10"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-400/25 bg-red-400/[0.08] px-4 py-3 text-sm leading-6 text-red-200"
                >
                  {error}
                </div>
              )}

              {message && (
                <div
                  role="status"
                  className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.08] px-4 py-3 text-sm leading-6 text-emerald-200"
                >
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d6b36a] to-[#ebce8e] px-5 py-4 text-sm font-bold text-[#111111] shadow-lg shadow-[#d6b36a]/[0.08] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Please wait..."
                  : mode === "login"
                  ? "Sign in with Password"
                  : "Create Account with Password"}
                {!loading && (
                  <span className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                )}
              </button>

              <div className="pt-2 text-center text-xs text-white/60">
                <button
                  type="button"
                  onClick={() => changeMode(mode === "login" ? "signup" : "login")}
                  className="font-medium text-[#e5ca91] hover:underline"
                >
                  {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
                </button>
              </div>
            </form>
          )}

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/[0.09]" />
            <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
              Your next experience
            </span>
            <div className="h-px flex-1 bg-white/[0.09]" />
          </div>

          <div className="border-t border-white/[0.08] pt-5 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-[#f0dcae]"
            >
              <span>←</span>
              Back to homepage
            </Link>
          </div>
        </section>

        <p className="mt-6 text-center text-[11px] leading-5 text-white/40">
          Discover. Connect. Relay.
        </p>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#090a0c] text-[#f0dcae]">
          Loading CineRelay...
        </main>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
