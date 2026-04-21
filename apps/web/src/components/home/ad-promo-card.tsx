"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  // When set, the input auto-fills with this value. Only overwrites while the
  // field is empty or still holding the last auto-filled value — user edits
  // are preserved.
  prefill?: string | null;
}

export function AdPromoCard({ prefill }: Props = {}) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<null | { kind: "ok" | "err"; msg: string }>(
    null,
  );
  const lastPrefillRef = useRef("");

  useEffect(() => {
    if (!prefill) return;
    setCode((current) => {
      if (current === "" || current === lastPrefillRef.current) {
        lastPrefillRef.current = prefill;
        return prefill;
      }
      return current;
    });
  }, [prefill]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setStatus({ kind: "err", msg: "Enter the code you heard on the episode." });
      return;
    }
    // Placeholder — real redemption wiring can go here once we add an endpoint.
    setStatus({
      kind: "ok",
      msg: `Got it — "${trimmed}" queued up. Check your email for the discount.`,
    });
    setCode("");
  }

  return (
    <div className="glass rounded-[32px] p-6 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <span className="chip chip-pink">Ad Promo Code</span>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-ink-900">
            Heard something good?
          </h3>
          <p className="mt-1 text-sm leading-snug text-ink-500">
            This is where our listeners enter codes to get special discounts on
            brands.
          </p>
        </div>
      </div>
      <form onSubmit={onSubmit} className="flex items-stretch gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (status) setStatus(null);
          }}
          placeholder="e.g. FLIPCAST20"
          className="h-12 flex-1 rounded-full bg-white/80 px-5 text-base uppercase tracking-wide text-ink-900 outline-none ring-1 ring-slate-200 transition placeholder:text-ink-300 focus:ring-2 focus:ring-sky-300"
          autoComplete="off"
          maxLength={32}
        />
        <button
          type="submit"
          className="inline-flex h-12 shrink-0 items-center rounded-full bg-brand-gradient px-6 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.02] active:scale-[0.98]"
        >
          Get it
        </button>
      </form>
      {status && (
        <div
          className={`mt-3 rounded-2xl px-4 py-2.5 text-sm ${
            status.kind === "ok"
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
              : "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
          }`}
        >
          {status.msg}
        </div>
      )}
    </div>
  );
}
