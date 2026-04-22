"use client";

import { useEffect, useState } from "react";
import {
  SHARE_TARGETS,
  embedSnippet,
  playerUrl,
} from "@/lib/share";

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

const FEEDBACK_KEY = (rid: string) => `flipaudio:feedback:${rid}`;

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
        title: `flip.audio — ${topic}`,
        text: `Listen to "${topic}" on flip.audio`,
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
            Did you like it?
          </h3>
          <p className="mt-1 text-xs text-ink-500">
            We use this to make the next one better.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => vote("up")}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-gradient px-5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.02]"
            >
              <span aria-hidden>👍</span> Loved it
            </button>
            <button
              type="button"
              onClick={() => vote("down")}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white/85 px-5 text-sm font-semibold text-ink-700 ring-1 ring-slate-200 transition hover:bg-white"
            >
              <span aria-hidden>👎</span> Not for me
            </button>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="ml-auto text-xs font-medium text-ink-400 hover:text-ink-700"
              >
                Skip
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
                Share it.
              </h3>
              <p className="mt-1 text-xs text-ink-500">
                Send the player link — anyone can listen, no signup needed.
              </p>
            </div>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full bg-white/80 text-ink-500 ring-1 ring-slate-200 hover:text-ink-900"
              >
                ✕
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {SHARE_TARGETS.map((t) => (
              <ShareTile
                key={t.key}
                label={t.label}
                accent={t.accent}
                href={t.build(topic, shareUrl)}
              />
            ))}
            {typeof navigator !== "undefined" && "share" in navigator && (
              <ShareTile
                label="More…"
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
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={() => setShowEmbed((v) => !v)}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white/85 px-4 text-sm font-medium text-ink-700 ring-1 ring-slate-200 transition hover:bg-white"
            >
              <span aria-hidden>{`</>`}</span>
              {showEmbed ? "Hide embed" : "Embed"}
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
            <span>Glad you liked it.</span>
            <button
              type="button"
              onClick={() => setPhase("rate")}
              className="ml-auto font-medium text-ink-500 hover:text-ink-700"
            >
              Change vote
            </button>
          </div>
        </div>
      )}

      {phase === "thanks" && (
        <div>
          <h3 className="text-base font-semibold text-ink-900">
            Thanks for the feedback.
          </h3>
          <p className="mt-1 text-xs text-ink-500">
            We'll use it to tune the next one.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setPhase("rate")}
              className="text-xs font-medium text-ink-500 hover:text-ink-700"
            >
              Change vote
            </button>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="ml-auto inline-flex h-10 items-center rounded-full bg-ink-900 px-5 text-sm font-semibold text-white transition hover:scale-[1.02]"
              >
                Done
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

