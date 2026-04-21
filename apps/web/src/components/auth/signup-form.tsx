"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  googleEnabled: boolean;
}

export function SignupForm({ googleEnabled }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/library";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't create the account.");
        return;
      }
      const signin = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!signin || signin.error) {
        setError("Account created. Try logging in.");
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  function onGoogle() {
    void signIn("google", { callbackUrl: next });
  }

  return (
    <div className="flex flex-col gap-5">
      {googleEnabled && (
        <>
          <button
            type="button"
            onClick={onGoogle}
            className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-full bg-white px-5 text-sm font-semibold text-ink-900 ring-1 ring-slate-200 transition hover:shadow-card"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#EA4335"
                d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4-5.5 4-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.6-2.6C16.9 3.4 14.7 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12S6.8 21.5 12 21.5c6.9 0 9.5-4.8 9.5-7.3 0-.5 0-.9-.1-1.3H12z"
              />
            </svg>
            Sign up with Google
          </button>
          <div className="flex items-center gap-3 text-xs text-ink-400">
            <div className="h-px flex-1 bg-slate-200" />
            <span>or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">
            Display name (optional)
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="How should we greet you?"
            maxLength={80}
            className="w-full rounded-2xl bg-white/80 px-4 py-3 text-base text-ink-900 outline-none ring-1 ring-slate-200 transition focus:ring-2 focus:ring-sky-300"
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">
            Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl bg-white/80 px-4 py-3 text-base text-ink-900 outline-none ring-1 ring-slate-200 transition focus:ring-2 focus:ring-sky-300"
            autoComplete="email"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">
            Password
          </span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl bg-white/80 px-4 py-3 text-base text-ink-900 outline-none ring-1 ring-slate-200 transition focus:ring-2 focus:ring-sky-300"
            autoComplete="new-password"
          />
          <span className="mt-1 block text-[11px] text-ink-400">
            At least 8 characters.
          </span>
        </label>
        {error && (
          <div className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-100">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-12 items-center justify-center rounded-full bg-brand-gradient px-6 text-base font-semibold text-white shadow-glow transition hover:scale-[1.01] disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
