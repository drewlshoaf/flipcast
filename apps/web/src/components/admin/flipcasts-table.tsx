"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClaudeUsageAggregate } from "@flipcast/types";

export interface AdminItem {
  kind: "station_intro" | "ad" | "welcome" | "scene";
  label: string;
  chars: number;
  durationSec: number;
}

export interface AdminFlipcastRow {
  id: string;
  createdAt: string;
  ownerEmail: string | null;
  topic: string;
  format: string;
  vibe: string | null;
  status: string;
  durationTargetSeconds: number;
  items: AdminItem[];
  sceneCount: number;
  adCount: number;
  adChars: number;
  sceneChars: number;
  totalChars: number;
  claudeCostUsd: number | null;
  elevenLabsCostUsd: number;
  claudeUsage: ClaudeUsageAggregate | null;
}

type SortKey =
  | "createdAt"
  | "ownerEmail"
  | "topic"
  | "format"
  | "status"
  | "sceneCount"
  | "adCount"
  | "sceneChars"
  | "adChars"
  | "totalChars"
  | "claudeCostUsd"
  | "elevenLabsCostUsd";

type SortDir = "asc" | "desc";

function fmtUsd(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v < 0.005) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

function fmtInt(v: number): string {
  return v.toLocaleString();
}

function fmtDuration(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  );
}

function compare(a: AdminFlipcastRow, b: AdminFlipcastRow, key: SortKey): number {
  const av = a[key];
  const bv = b[key];
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av).localeCompare(String(bv));
}

export function FlipcastsAdminTable({ rows }: { rows: AdminFlipcastRow[] }) {
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const statuses = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) s.add(r.status);
    return ["all", ...Array.from(s).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const arr = rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.topic.toLowerCase().includes(q) ||
        (r.ownerEmail?.toLowerCase().includes(q) ?? false) ||
        r.id.toLowerCase().includes(q)
      );
    });
    arr.sort((a, b) => {
      const n = compare(a, b, sortKey);
      return sortDir === "asc" ? n : -n;
    });
    return arr;
  }, [rows, filter, statusFilter, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "createdAt" ? "desc" : "asc");
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this flipcast? (DB only — S3 objects will be orphaned.)"))
      return;
    setBusyId(id);
    fetch(`/api/admin/flipcasts/${id}`, { method: "DELETE" })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        startTransition(() => router.refresh());
      })
      .catch((e) => alert(`Delete failed: ${e.message}`))
      .finally(() => setBusyId(null));
  };

  const handlePurge = (id: string) => {
    if (
      !confirm(
        "Purge this flipcast? Deletes S3 objects AND the DB row. Cannot be undone.",
      )
    )
      return;
    setBusyId(id);
    fetch(`/api/admin/flipcasts/${id}/purge`, { method: "POST" })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        startTransition(() => router.refresh());
      })
      .catch((e) => alert(`Purge failed: ${e.message}`))
      .finally(() => setBusyId(null));
  };

  return (
    <div className="glass overflow-hidden rounded-3xl shadow-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by topic, email, or id…"
          className="h-10 flex-1 min-w-[220px] rounded-full border border-ink-200 bg-white px-4 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-300 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-full border border-ink-200 bg-white px-4 text-sm text-ink-900 focus:outline-none"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-400">
          {filtered.length} / {rows.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <Th w="w-8" />
              <Th onSort={() => onSort("createdAt")} active={sortKey === "createdAt"} dir={sortDir}>
                Created
              </Th>
              <Th onSort={() => onSort("ownerEmail")} active={sortKey === "ownerEmail"} dir={sortDir}>
                User
              </Th>
              <Th onSort={() => onSort("topic")} active={sortKey === "topic"} dir={sortDir}>
                Topic
              </Th>
              <Th onSort={() => onSort("status")} active={sortKey === "status"} dir={sortDir}>
                Status
              </Th>
              <Th onSort={() => onSort("sceneCount")} active={sortKey === "sceneCount"} dir={sortDir} align="right">
                Scenes
              </Th>
              <Th onSort={() => onSort("adCount")} active={sortKey === "adCount"} dir={sortDir} align="right">
                Ads
              </Th>
              <Th onSort={() => onSort("sceneChars")} active={sortKey === "sceneChars"} dir={sortDir} align="right">
                Scene chars
              </Th>
              <Th onSort={() => onSort("adChars")} active={sortKey === "adChars"} dir={sortDir} align="right">
                Ad chars
              </Th>
              <Th onSort={() => onSort("totalChars")} active={sortKey === "totalChars"} dir={sortDir} align="right">
                Total chars
              </Th>
              <Th onSort={() => onSort("claudeCostUsd")} active={sortKey === "claudeCostUsd"} dir={sortDir} align="right">
                Claude $
              </Th>
              <Th onSort={() => onSort("elevenLabsCostUsd")} active={sortKey === "elevenLabsCostUsd"} dir={sortDir} align="right">
                11Labs $
              </Th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {filtered.map((r) => {
              const isExpanded = expanded === r.id;
              const isBusy = busyId === r.id || pending;
              return (
                <Fragment key={r.id}>
                  <tr className="hover:bg-ink-50/50">
                    <td className="px-3 py-2 text-ink-400">
                      <button
                        onClick={() => setExpanded(isExpanded ? null : r.id)}
                        className="h-6 w-6 rounded-full hover:bg-ink-100"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? "▾" : "▸"}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-500">
                      {fmtDate(r.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-ink-700">
                      {r.ownerEmail ?? "—"}
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-ink-900" title={r.topic}>
                      {r.topic}
                    </td>
                    <td className="px-3 py-2 text-ink-500">{r.status}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                      {r.sceneCount}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                      {r.adCount}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                      {fmtInt(r.sceneChars)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                      {fmtInt(r.adChars)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-900">
                      {fmtInt(r.totalChars)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                      {fmtUsd(r.claudeCostUsd)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                      {fmtUsd(r.elevenLabsCostUsd)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={isBusy}
                        className="mr-1 rounded-full border border-ink-200 px-3 py-1 text-xs text-ink-700 hover:bg-ink-50 disabled:opacity-40"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => handlePurge(r.id)}
                        disabled={isBusy}
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                      >
                        Purge
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-ink-50/60">
                      <td />
                      <td colSpan={12} className="px-3 py-4">
                        <ExpandedDetail row={r} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-8 text-center text-ink-400">
                  No matching flipcasts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  onSort,
  active,
  dir,
  align = "left",
  w,
}: {
  children?: React.ReactNode;
  onSort?: () => void;
  active?: boolean;
  dir?: SortDir;
  align?: "left" | "right";
  w?: string;
}) {
  const base = `px-3 py-3 font-medium ${w ?? ""} ${
    align === "right" ? "text-right" : "text-left"
  }`;
  if (!onSort) return <th className={base}>{children}</th>;
  return (
    <th className={base}>
      <button
        onClick={onSort}
        className={`inline-flex items-center gap-1 hover:text-ink-700 ${
          active ? "text-ink-900" : ""
        }`}
      >
        {children}
        {active && <span className="text-ink-400">{dir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

function ExpandedDetail({ row }: { row: AdminFlipcastRow }) {
  const totalDuration = row.items.reduce((s, i) => s + i.durationSec, 0);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
          Sequence breakdown
        </div>
        <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Duration</th>
                <th className="px-3 py-2 text-right font-medium">Chars</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {row.items.map((item, i) => (
                <tr key={i} className={kindRowClass(item.kind)}>
                  <td className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                    {kindLabel(item.kind)}
                  </td>
                  <td className="px-3 py-1.5 text-ink-700">{item.label}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink-700">
                    {fmtDuration(item.durationSec)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink-700">
                    {fmtInt(item.chars)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-ink-50 text-sm">
              <tr>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 font-semibold text-ink-900">Total</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink-900">
                  {fmtDuration(totalDuration)}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink-900">
                  {fmtInt(row.totalChars)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-4 rounded-2xl border border-ink-100 bg-white p-4 text-sm">
          <Row
            label={`Scene chars (×${row.sceneCount}, includes welcome)`}
            value={fmtInt(row.sceneChars)}
            bold
          />
          <Row
            label={`Ad chars (×${row.adCount})`}
            value={fmtInt(row.adChars)}
            bold
          />
          <div className="my-2 border-t border-ink-100" />
          <Row label="Grand total chars" value={fmtInt(row.totalChars)} bold />
          <Row
            label="11Labs cost (scene + welcome only)"
            value={fmtUsd(row.elevenLabsCostUsd)}
            bold
          />
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
          Claude usage
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-4 text-sm">
          {row.claudeUsage ? (
            <>
              <Row
                label="Input tokens"
                value={fmtInt(row.claudeUsage.totalInputTokens)}
              />
              <Row
                label="Output tokens"
                value={fmtInt(row.claudeUsage.totalOutputTokens)}
              />
              <Row
                label="Cache read tokens"
                value={fmtInt(row.claudeUsage.totalCacheReadTokens)}
              />
              <Row
                label="Cache creation tokens"
                value={fmtInt(row.claudeUsage.totalCacheCreationTokens)}
              />
              <div className="my-2 border-t border-ink-100" />
              {Object.entries(row.claudeUsage.byModel).map(([model, u]) => (
                <div key={model} className="mt-2 text-xs text-ink-500">
                  <div className="font-semibold text-ink-700">{model}</div>
                  <div>
                    in {fmtInt(u.inputTokens)} · out {fmtInt(u.outputTokens)} ·
                    cacheR {fmtInt(u.cacheReadTokens)} · cacheW{" "}
                    {fmtInt(u.cacheCreationTokens)}
                  </div>
                </div>
              ))}
              <div className="my-2 border-t border-ink-100" />
              <Row label="Cost" value={fmtUsd(row.claudeCostUsd)} bold />
            </>
          ) : (
            <div className="text-ink-400">
              No usage recorded (created before instrumentation).
            </div>
          )}
        </div>
        <div className="mt-3 text-xs text-ink-400">
          id: <span className="font-mono">{row.id}</span>
        </div>
      </div>
    </div>
  );
}

function kindLabel(kind: AdminItem["kind"]): string {
  if (kind === "station_intro") return "INTRO";
  if (kind === "ad") return "AD";
  if (kind === "welcome") return "WELCOME";
  return "SCENE";
}

function kindRowClass(kind: AdminItem["kind"]): string {
  if (kind === "ad") return "bg-pink-50/40";
  if (kind === "welcome") return "bg-sky-50/40";
  if (kind === "scene") return "bg-emerald-50/30";
  return "";
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1 ${
        muted ? "text-ink-400" : "text-ink-700"
      } ${bold ? "font-semibold text-ink-900" : ""}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
