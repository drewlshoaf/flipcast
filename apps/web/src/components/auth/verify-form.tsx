"use client";

import { signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  email: string;
  next: string;
}

interface PendingCreds {
  email: string;
  password: string;
}

export function VerifyForm({ email: emailFromUrl, next }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(emailFromUrl);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [havePendingPw, setHavePendingPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const resendAtRef = useRef<number>(0);

  // Pull the password stashed by SignupForm so the user doesn't have to
  // retype it. Missing/quota-blocked means we fall back to asking for it.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("flipcast:pending_pw");
      if (!raw) return;
      const parsed = JSON.parse(raw) as PendingCreds;
      if (parsed?.email && parsed?.password) {
        if (!email) setEmail(parsed.email);
        setPassword(parsed.password);
        setHavePendingPw(true);
      }
    } catch {
      /* ignore */
    }
  }, [email]);

  function clearPendingPw() {
    try {
      window.sessionStorage.removeItem("flipcast:pending_pw");
    } catch {
      /* ignore */
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Verification failed.");
        return;
      }
      // Now sign in with the password we stashed (or the one they retyped).
      const signin = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      clearPendingPw();
      if (!signin || signin.error) {
        setInfo("Email verified. Log in to continue.");
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    // Simple client-side 60s throttle so the button isn't spammable.
    const now = Date.now();
    if (now - resendAtRef.current < 60_000) {
      setInfo("Hang on — wait a few seconds before resending.");
      return;
    }
    resendAtRef.current = now;
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      await fetch("/api/verify/resend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setInfo("New code sent. Check the server logs.");
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
          6-digit code
        </span>
        <input
          type="text"
          required
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          className="w-full rounded-2xl bg-white/80 px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-ink-900 outline-none ring-1 ring-slate-200 transition focus:ring-2 focus:ring-sky-300"
          autoComplete="one-time-code"
          autoFocus
        />
      </label>
      {!havePendingPw && (
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
            autoComplete="current-password"
          />
          <span className="mt-1 block text-[11px] text-ink-400">
            We lost the one you just typed — re-enter it so we can log you in.
          </span>
        </label>
      )}
      {error && (
        <div className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-100">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded-2xl bg-sky-50 p-3 text-sm text-sky-700 ring-1 ring-sky-100">
          {info}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-12 items-center justify-center rounded-full bg-brand-gradient px-6 text-base font-semibold text-white shadow-glow transition hover:scale-[1.01] disabled:opacity-60"
      >
        {submitting ? "Verifying…" : "Verify"}
      </button>
      <button
        type="button"
        onClick={onResend}
        disabled={resending}
        className="text-sm font-medium text-ink-500 underline decoration-slate-300 underline-offset-4 hover:text-ink-900 disabled:opacity-60"
      >
        {resending ? "Resending…" : "Resend code"}
      </button>
    </form>
  );
}
