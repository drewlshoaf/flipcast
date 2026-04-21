"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

export interface SessionUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  isAdmin?: boolean;
}

interface Props {
  user: SessionUser | null;
  loginNext?: string;
}

function initials(user: SessionUser): string {
  const base = user.name?.trim() || user.email?.trim() || "?";
  const parts = base.split(/[@\s]/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function UserChip({ user, loginNext }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!user) {
    const nextQuery = loginNext
      ? `?next=${encodeURIComponent(loginNext)}`
      : "";
    return (
      <div className="flex items-center gap-2">
        <Link
          href={`/login${nextQuery}`}
          className="inline-flex h-10 items-center rounded-full bg-white/70 px-4 text-sm font-medium text-ink-700 ring-1 ring-slate-200 transition hover:bg-white"
        >
          Log in
        </Link>
        <Link
          href={`/signup${nextQuery}`}
          className="inline-flex h-10 items-center rounded-full bg-ink-900 px-4 text-sm font-semibold text-white transition hover:scale-[1.02]"
        >
          Sign up
        </Link>
      </div>
    );
  }

  const displayName = user.name || (user.email ? user.email.split("@")[0] : "You");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-white/80 pl-1 pr-4 text-sm font-medium text-ink-700 ring-1 ring-slate-200 transition hover:bg-white"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            className="h-8 w-8 rounded-full object-cover ring-1 ring-white"
          />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-gradient text-[11px] font-semibold text-white">
            {initials(user)}
          </span>
        )}
        <span className="max-w-[140px] truncate">{displayName}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open && (
        <div className="glass absolute right-0 top-12 z-20 w-56 rounded-2xl p-2 shadow-cardHover">
          <div className="border-b border-slate-200/70 px-3 py-2">
            <div className="truncate text-sm font-semibold text-ink-900">
              {displayName}
            </div>
            {user.email && (
              <div className="truncate text-xs text-ink-400">
                {user.email}
              </div>
            )}
          </div>
          <Link
            href="/library"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm text-ink-700 transition hover:bg-white/70"
          >
            My library
          </Link>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm text-ink-700 transition hover:bg-white/70"
          >
            Profile
          </Link>
          {user.isAdmin && (
            <Link
              href="/admin/flipcasts"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm font-semibold text-pink-600 transition hover:bg-white/70"
            >
              Admin
            </Link>
          )}
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/" })}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-ink-700 transition hover:bg-white/70"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
