
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "login">(
  typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("mode") === "login"
    ? "login"
    : "signup"
);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        setMessage(
          data.session
            ? "Account created successfully! You can now continue."
            : "Account created. Check your email to confirm your address, then log in."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        router.push("/sell");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080b12] px-5 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <Link href="/" className="font-bold text-amber-400">
          ◈ CineRelay
        </Link>

        <h1 className="mt-8 text-3xl font-black">
          {mode === "signup" ? "Join CineRelay" : "Welcome back"}
        </h1>

        <p className="mt-2 text-sm text-gray-400">
          {mode === "signup"
            ? "Create an account to join our marketplace."
            : "Log in to your CineRelay account."}
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div>
            <label className="mb-2 block text-sm">Email address</label>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-white/10 bg-[#111722] p-3 outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm">Password</label>
            <input
              required
              type="password"
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-xl border border-white/10 bg-[#111722] p-3 outline-none focus:border-amber-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-amber-400 px-5 py-3 font-bold text-black disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : mode === "signup"
                ? "Create account"
                : "Log in"}
          </button>
        </form>

        {message && (
          <p role="status" className="mt-5 break-words rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-300">
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setMessage("");
          }}
          className="mt-6 text-sm text-amber-400"
        >
          {mode === "signup"
            ? "Already registered? Log in"
            : "New here? Create an account"}
        </button>

        <Link href="/" className="mt-6 block text-sm text-gray-500 hover:text-gray-300">
          ← Back to homepage
        </Link>
      </section>
    </main>
  );
}
