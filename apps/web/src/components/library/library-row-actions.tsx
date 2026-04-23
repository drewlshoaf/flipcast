"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

interface Props {
  id: string;
  topic: string;
  // Only "complete" rows are shareable — half-baked rows would 404 in the
  // standalone player for the recipient.
  shareable: boolean;
}

export function LibraryRowActions({ id, topic, shareable }: Props) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<"share" | "delete" | null>(null);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  async function onShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy("share");
    try {
      const url = `${window.location.origin}/player/${id}`;
      await navigator.clipboard.writeText(url);
      showToast(t.studio.linkCopied);
    } catch {
      showToast(t.studio.copyFailed);
    } finally {
      setBusy(null);
    }
  }

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const ok = window.confirm(
      t.library.deleteConfirm.replace("{topic}", topic),
    );
    if (!ok) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/flipcasts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`${res.status}`);
      showToast(t.library.deleted);
      startTransition(() => router.refresh());
    } catch {
      showToast(t.library.deleteFailed);
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {shareable && (
        <button
          type="button"
          onClick={onShare}
          disabled={busy !== null || pending}
          aria-label={t.library.shareAria}
          title={t.library.shareAria}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/80 text-ink-500 ring-1 ring-slate-200 transition hover:text-pink-600 hover:ring-pink-300 disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4m0 0L8 6m4-4v14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={busy !== null || pending}
        aria-label={t.library.deleteAria}
        title={t.library.deleteAria}
        className="grid h-9 w-9 place-items-center rounded-full bg-white/80 text-ink-500 ring-1 ring-slate-200 transition hover:text-rose-600 hover:ring-rose-300 disabled:opacity-50"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6h14zM10 11v6M14 11v6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {toast && (
        <span
          role="status"
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink-900/90 px-5 py-2.5 text-sm font-medium text-white shadow-glow"
        >
          {toast}
        </span>
      )}
    </div>
  );
}
