"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  userId: string;
  email: string;
  initialName: string;
  initialImage: string | null;
}

function initialsFor(name: string, email: string): string {
  const base = (name.trim() || email).split(/[@\s]/).filter(Boolean);
  if (base.length === 0) return "?";
  if (base.length === 1) return base[0]!.slice(0, 2).toUpperCase();
  return (base[0]![0]! + base[1]![0]!).toUpperCase();
}

export function ProfileForm({
  email,
  initialName,
  initialImage,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(initialName);
  const [image, setImage] = useState<string | null>(initialImage);
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{
    text: string;
    kind: "ok" | "err";
  } | null>(null);

  function flash(text: string, kind: "ok" | "err" = "ok") {
    setToast({ text, kind });
    window.setTimeout(() => setToast(null), 2500);
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flash(data?.error ?? "Couldn't save.", "err");
        return;
      }
      flash("Saved.");
      router.refresh();
    } finally {
      setSavingName(false);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      flash("Image must be under 5 MB.", "err");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flash(data?.error ?? "Upload failed.", "err");
        return;
      }
      setImage(data.image as string);
      flash("Avatar updated.");
      router.refresh();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Avatar block */}
      <section className="glass rounded-3xl p-6 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-400">
          Avatar
        </h2>
        <div className="mt-4 flex items-center gap-5">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              className="h-20 w-20 rounded-full object-cover ring-2 ring-white shadow-card"
            />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-full bg-brand-gradient text-2xl font-semibold text-white shadow-glow">
              {initialsFor(name, email)}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex h-10 items-center rounded-full bg-ink-900 px-5 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-60"
            >
              {uploading ? "Uploading…" : image ? "Replace" : "Upload"}
            </button>
            <span className="text-xs text-ink-400">
              PNG/JPG, under 5 MB.
            </span>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onPickFile}
          className="hidden"
        />
      </section>

      {/* Name + email block */}
      <section className="glass rounded-3xl p-6 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-400">
          Identity
        </h2>
        <form onSubmit={saveName} className="mt-4 flex flex-col gap-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">
              Display name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should we call you?"
              maxLength={80}
              className="w-full rounded-2xl bg-white/80 px-4 py-3 text-base text-ink-900 outline-none ring-1 ring-slate-200 transition focus:ring-2 focus:ring-sky-300"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">
              Email
            </span>
            <input
              type="email"
              value={email}
              disabled
              className="w-full cursor-not-allowed rounded-2xl bg-slate-50 px-4 py-3 text-base text-ink-500 ring-1 ring-slate-200"
            />
            <span className="mt-1 block text-[11px] text-ink-400">
              Email is your login id and can't be changed yet.
            </span>
          </label>
          <button
            type="submit"
            disabled={savingName || name === initialName}
            className="inline-flex h-11 items-center justify-center self-start rounded-full bg-brand-gradient px-6 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] disabled:opacity-60"
          >
            {savingName ? "Saving…" : "Save name"}
          </button>
        </form>
      </section>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-glow ${
            toast.kind === "err" ? "bg-rose-600/90" : "bg-ink-900/90"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
