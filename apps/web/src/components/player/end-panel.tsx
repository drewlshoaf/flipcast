"use client";

import { useEffect, useState } from "react";
import {
  SHARE_TARGETS,
  embedSnippet,
  playerUrl,
} from "@/lib/share";
import { useT } from "@/lib/i18n/client";

type Phase = "rate" | "share" | "thanks";

interface Props {
  requestId: string;
  topic: string;
  // Called when the user is fully done with the panel (close / dismiss).
  onDismiss?: () => void;
  // Visual variant: "inline" looks like a card on its own, "overlay" suits
  // the modal which already has a card frame around it.
  variant?: "inline" | "overlay";
}

const FEEDBACK_KEY = (rid: string) => `flipcast:feedback:${rid}`;

function readPriorVote(rid: string): "up" | "down" | null {
  try {
    const v = window.localStorage.getItem(FEEDBACK_KEY(rid));
    return v === "up" || v === "down" ? v : null;
  } catch {
    return null;
  }
}

function persistVote(rid: string, v: "up" | "down") {
  try {
    window.localStorage.setItem(FEEDBACK_KEY(rid), v);
  } catch {
    /* ignore */
  }
  // Best-effort backend ping; the endpoint is optional for now.
  void fetch(`/api/flipcasts/${rid}/like`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ liked: v === "up" }),
    keepalive: true,
  }).catch(() => void 0);
}

export function EndPanel({
  requestId,
  topic,
  onDismiss,
  variant = "inline",
}: Props) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>(() => {
    if (typeof window === "undefined") return "rate";
    const prior = readPriorVote(requestId);
    if (prior === "up") return "share";
    if (prior === "down") return "thanks";
    return "rate";
  });
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShareUrl(playerUrl(requestId));
  }, [requestId]);

  function vote(v: "up" | "down") {
    persistVote(requestId, v);
    setPhase(v === "up" ? "share" : "thanks");
  }

  function nativeShare() {
    if (typeof navigator === "undefined" || !("share" in navigator)) return;
    navigator
      .share({
        title: t.endPanel.nativeShareTitle.replace("{topic}", topic),
        text: t.endPanel.nativeShareText.replace("{topic}", topic),
        url: shareUrl,
      })
      .catch(() => void 0);
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  const containerClass =
    variant === "overlay"
      ? "rounded-3xl bg-white/85 p-5 ring-1 ring-slate-200/80 backdrop-blur"
      : "glass rounded-3xl p-6 shadow-card";

  return (
    <section className={containerClass}>
      {phase === "rate" && (
        <div>
          <h3 className="text-base font-semibold text-ink-900">
            {t.endPanel.rateTitle}
          </h3>
          <p className="mt-1 text-xs text-ink-500">
            {t.endPanel.rateSubtitle}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => vote("up")}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-gradient px-5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.02]"
            >
              <span aria-hidden>👍</span> {t.endPanel.loved}
            </button>
            <button
              type="button"
              onClick={() => vote("down")}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white/85 px-5 text-sm font-semibold text-ink-700 ring-1 ring-slate-200 transition hover:bg-white"
            >
              <span aria-hidden>👎</span> {t.endPanel.notForMe}
            </button>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="ml-auto text-xs font-medium text-ink-400 hover:text-ink-700"
              >
                {t.endPanel.skip}
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "share" && (
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-ink-900">
                {t.endPanel.shareTitle}
              </h3>
              <p className="mt-1 text-xs text-ink-500">
                {t.endPanel.shareSubtitle}
              </p>
            </div>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label={t.endPanel.closeAria}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/80 text-ink-500 ring-1 ring-slate-200 hover:text-ink-900"
              >
                ✕
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {SHARE_TARGETS.map((target) => (
              <ShareTile
                key={target.key}
                label={target.label}
                accent={target.accent}
                href={target.build(topic, shareUrl)}
              />
            ))}
            {typeof navigator !== "undefined" && "share" in navigator && (
              <ShareTile
                label={t.endPanel.shareMore}
                accent="bg-pink-500 text-white"
                onClick={nativeShare}
              />
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white/85 px-4 text-sm font-medium text-ink-700 ring-1 ring-slate-200 transition hover:bg-white"
            >
              <span aria-hidden>🔗</span>
              {copied ? t.endPanel.copied : t.endPanel.copyLink}
            </button>
            <button
              type="button"
              onClick={() => setShowEmbed((v) => !v)}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white/85 px-4 text-sm font-medium text-ink-700 ring-1 ring-slate-200 transition hover:bg-white"
            >
              <span aria-hidden>{`</>`}</span>
              {showEmbed ? t.endPanel.hideEmbed : t.endPanel.embed}
            </button>
          </div>

          {showEmbed && (
            <div className="mt-3">
              <textarea
                readOnly
                value={embedSnippet(shareUrl)}
                className="h-24 w-full resize-none rounded-2xl bg-white/85 p-3 font-mono text-[11px] leading-relaxed text-ink-700 ring-1 ring-slate-200"
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
          )}

          <div className="mt-4 flex items-center gap-3 border-t border-slate-200/70 pt-3 text-xs text-ink-400">
            <span>{t.endPanel.gladYouLiked}</span>
            <button
              type="button"
              onClick={() => setPhase("rate")}
              className="ml-auto font-medium text-ink-500 hover:text-ink-700"
            >
              {t.endPanel.changeVote}
            </button>
          </div>
        </div>
      )}

      {phase === "thanks" && (
        <div>
          <h3 className="text-base font-semibold text-ink-900">
            {t.endPanel.thanksTitle}
          </h3>
          <p className="mt-1 text-xs text-ink-500">
            {t.endPanel.thanksSubtitle}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setPhase("rate")}
              className="text-xs font-medium text-ink-500 hover:text-ink-700"
            >
              {t.endPanel.changeVote}
            </button>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="ml-auto inline-flex h-10 items-center rounded-full bg-ink-900 px-5 text-sm font-semibold text-white transition hover:scale-[1.02]"
              >
                {t.endPanel.done}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ShareTile({
  label,
  href,
  onClick,
  accent,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  accent: string;
}) {
  const className = `inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl px-3 text-xs font-semibold ring-1 ring-slate-200/70 shadow-card transition hover:-translate-y-0.5 hover:shadow-cardHover ${accent}`;
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {label}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {label}
    </button>
  );
}

