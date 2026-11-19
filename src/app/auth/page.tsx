
"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = searchParams.get("mode") === "login" ? "login" : "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function changeMode(nextMode: "login" | "signup") {
    setMessage("");
    setError("");
    setPassword("");

    router.replace(`/auth?mode=${nextMode}`, { scroll: false });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
          router.replace("/profile");
          router.refresh();
          return;
        }

        setMessage(
          "Account created. Check your email for a confirmation link before signing in."
        );
      } else {
        const { error: loginError } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

        if (loginError) throw loginError;

        const next = searchParams.get("next");
        const safeNext =
          next && next.startsWith("/") && !next.startsWith("//")
            ? next
            : "/profile";

        router.replace(safeNext);
        router.refresh();
        return;
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Authentication failed. Please try again."
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
              {mode === "login"
                ? "Welcome back."
                : "Join CineRelay."}
            </h1>

            <p className="mt-3 text-sm leading-6 text-white/65">
              {mode === "login"
                ? "Sign in and pick up where your next experience begins."
                : "Create your account and discover your next experience."}
            </p>
          </div>

          {/* Mode switch */}
          <div className="mb-7 grid grid-cols-2 rounded-xl border border-white/[0.08] bg-black/20 p-1">
            <button
              type="button"
              onClick={() => changeMode("login")}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                mode === "login"
                  ? "bg-[#d6b36a] text-[#111111]"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Sign in
            </button>

            <button
              type="button"
              onClick={() => changeMode("signup")}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                mode === "signup"
                  ? "bg-[#d6b36a] text-[#111111]"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-white/85"
              >
                Email address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
                autoComplete={
                  mode === "login"
                    ? "current-password"
                    : "new-password"
                }
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
                  ? "Sign in to CineRelay"
                  : "Create your account"}

              {!loading && (
                <span className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/[0.09]" />
            <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
              Your next experience
            </span>
            <div className="h-px flex-1 bg-white/[0.09]" />
          </div>

          <p className="text-center text-sm text-white/60">
            {mode === "login"
              ? "New to CineRelay?"
              : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() =>
                changeMode(mode === "login" ? "signup" : "login")
              }
              className="font-semibold text-[#e5ca91] transition hover:text-[#fff0c5]"
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>

          <div className="mt-7 border-t border-white/[0.08] pt-5 text-center">
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
