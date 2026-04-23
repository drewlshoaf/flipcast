"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

// Single pill-shaped promo banner for Home V2: a pink label pill on the
// left, the input in the middle, and the submit button on the right — all
// wrapped so the whole thing reads as one integrated consumer control.
export function AdPromoBanner() {
  const t = useT();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<null | { kind: "ok" | "err"; msg: string }>(
    null,
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setStatus({ kind: "err", msg: t.adPromo.emptyError });
      return;
    }
    setStatus({
      kind: "ok",
      msg: t.adPromo.success.replace("{code}", `"${trimmed}"`),
    });
    setCode("");
  }

  return (
    <div className="relative">
      <form
        onSubmit={onSubmit}
        className="flex h-12 items-center gap-2 rounded-full bg-white/75 pl-2 pr-2 ring-1 ring-white/70 shadow-card backdrop-blur-md"
      >
        <span className="inline-flex h-8 shrink-0 items-center rounded-full bg-pink-100/90 px-3 text-[11px] font-semibold uppercase tracking-wide text-pink-700 ring-1 ring-pink-200/80">
          {t.adPromo.badge}
        </span>
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (status) setStatus(null);
          }}
          placeholder={t.adPromo.placeholder}
          className="h-8 min-w-0 flex-1 bg-transparent px-1 text-sm uppercase tracking-wide text-ink-900 outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-300"
          autoComplete="off"
          maxLength={32}
        />
        <button
          type="submit"
          className="inline-flex h-8 shrink-0 items-center rounded-full bg-brand-gradient px-4 text-xs font-semibold text-white shadow-glow transition hover:scale-[1.02] active:scale-[0.98]"
        >
          {t.adPromo.submit}
        </button>
      </form>
      {status && (
        <div
          role="status"
          className={`absolute left-1/2 top-[56px] z-30 w-max max-w-[420px] -translate-x-1/2 rounded-full px-4 py-1.5 text-xs shadow-card ${
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
