"use client";

import { useEffect, useRef, useState } from "react";
import {
  SHARE_TARGETS,
  embedSnippet,
  playerUrl,
} from "@/lib/share";

type Expanded = "share" | "embed" | null;

interface Props {
  requestId: string;
  topic: string;
  // Visual size — "compact" suits the modal header strip, "default" for
  // standalone player.
  size?: "compact" | "default";
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

function persistVote(rid: string, v: "up" | "down" | null) {
  try {
    if (v) window.localStorage.setItem(FEEDBACK_KEY(rid), v);
    else window.localStorage.removeItem(FEEDBACK_KEY(rid));
  } catch {
    /* ignore */
  }
  if (v) {
    void fetch(`/api/flipcasts/${rid}/like`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ liked: v === "up" }),
      keepalive: true,
    }).catch(() => void 0);
  }
}

export function PlayerActions({
  requestId,
  topic,
  size = "default",
}: Props) {
  const [liked, setLiked] = useState<"up" | "down" | null>(null);
  const [expanded, setExpanded] = useState<Expanded>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setShareUrl(playerUrl(requestId));
    setLiked(readPriorVote(requestId));
  }, [requestId]);

  // Click outside to close any expanded panel.
  useEffect(() => {
    if (!expanded) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setExpanded(null);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [expanded]);

  function toggleLike() {
    const next = liked === "up" ? null : "up";
    setLiked(next);
    persistVote(requestId, next);
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

  async function copyEmbed() {
    const snip = embedSnippet(shareUrl);
    try {
      await navigator.clipboard.writeText(snip);
      setEmbedCopied(true);
      window.setTimeout(() => setEmbedCopied(false), 1800);
    } catch {
      /* ignore */
    }
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

  const btnSize = size === "compact" ? "h-9 w-9" : "h-10 w-10";
  const iconSize = size === "compact" ? 14 : 16;

  return (
    <div ref={containerRef} className="relative">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-white/85 p-1 ring-1 ring-slate-200 shadow-card">
        <ToolButton
          active={liked === "up"}
          onClick={toggleLike}
          title={liked === "up" ? "Liked — tap to undo" : "Like this flip"}
          className={btnSize}
        >
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill={liked === "up" ? "#ec4899" : "none"}
            stroke={liked === "up" ? "#ec4899" : "currentColor"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 10-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </ToolButton>
        <ToolButton
          active={expanded === "share"}
          onClick={() => setExpanded(expanded === "share" ? null : "share")}
          title="Share"
          className={btnSize}
        >
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </ToolButton>
        <ToolButton
          active={expanded === "embed"}
          onClick={() => setExpanded(expanded === "embed" ? null : "embed")}
          title="Embed"
          className={btnSize}
        >
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </ToolButton>
      </div>

      {expanded === "share" && (
        <div className="absolute right-0 top-12 z-30 w-[320px] rounded-3xl bg-white p-4 ring-1 ring-slate-200 shadow-cardHover">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-ink-900">Share</h4>
            <button
              type="button"
              onClick={() => setExpanded(null)}
              aria-label="Close"
              className="text-ink-400 hover:text-ink-700"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SHARE_TARGETS.map((t) => (
              <a
                key={t.key}
                href={t.build(topic, shareUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex h-10 items-center justify-center rounded-xl px-2 text-[11px] font-semibold ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-card ${t.accent}`}
              >
                {t.label}
              </a>
            ))}
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                type="button"
                onClick={nativeShare}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-pink-500 px-2 text-[11px] font-semibold text-white ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-card"
              >
                More…
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-ink-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
          >
            <span aria-hidden>🔗</span>
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      )}

      {expanded === "embed" && (
        <div className="absolute right-0 top-12 z-30 w-[360px] rounded-3xl bg-white p-4 ring-1 ring-slate-200 shadow-cardHover">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-ink-900">Embed</h4>
            <button
              type="button"
              onClick={() => setExpanded(null)}
              aria-label="Close"
              className="text-ink-400 hover:text-ink-700"
            >
              ✕
            </button>
          </div>
          <p className="mb-2 text-xs text-ink-500">
            Drop this iframe anywhere — autoplay-friendly.
          </p>
          <textarea
            readOnly
            value={embedSnippet(shareUrl)}
            onFocus={(e) => e.currentTarget.select()}
            className="h-24 w-full resize-none rounded-2xl bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-ink-700 ring-1 ring-slate-200"
          />
          <button
            type="button"
            onClick={copyEmbed}
            className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-ink-900 px-4 text-sm font-semibold text-white transition hover:scale-[1.01]"
          >
            {embedCopied ? "Copied!" : "Copy snippet"}
          </button>
        </div>
      )}
    </div>
  );
}

function ToolButton({
  children,
  onClick,
  title,
  active,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`grid place-items-center rounded-full transition hover:bg-white ${className ?? ""} ${
        active ? "bg-pink-50 text-pink-600" : "text-ink-500"
      }`}
    >
      {children}
    </button>
  );
}
