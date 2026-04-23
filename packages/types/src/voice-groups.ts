// Pre-curated voice combos for multi-speaker formats. Listeners pick a
// duo (Pals) or trio (Panel) instead of cherry-picking individual voices,
// so the chemistry is always intentional. Each group resolves to the same
// voiceIds[] we already POST — no backend wiring change.
//
// Preview audio convention: when a recording exists, drop it at
// `apps/web/public/voice-groups/{id}.mp3`. The UI play button hits the URL
// and fails silently if the file is missing, so groups can ship before
// their chemistry samples are recorded.

import type { VoiceLanguage } from "./voices";

export type VoiceGroupFormat = "pals" | "panel";

export interface VoiceGroup {
  id: string;
  label: string;
  // Optional one-line vibe descriptor shown under the names.
  description?: string;
  language: VoiceLanguage;
  format: VoiceGroupFormat;
  // Order matters for multi-speaker scripts: speaker 0 is voiceIds[0], etc.
  voiceIds: string[];
  previewUrl: string;
}

const url = (id: string) => `/voice-groups/${id}.mp3`;

export const VOICE_GROUPS: VoiceGroup[] = [
  // ---------- Pals (2 voices) — English ----------
  {
    id: "pals-en-1",
    label: "Sarah & Allie",
    description: "Two bright voices, fast back-and-forth.",
    language: "en",
    format: "pals",
    voiceIds: ["fa-sarah", "fa-allie"],
    previewUrl: url("pals-en-1"),
  },
  {
    id: "pals-en-2",
    label: "Jim & Alex",
    description: "Steady + friendly. Easy buddy energy.",
    language: "en",
    format: "pals",
    voiceIds: ["fa-jim", "fa-alex"],
    previewUrl: url("pals-en-2"),
  },
  {
    id: "pals-en-3",
    label: "Sarah & Charlie",
    description: "Bright meets smooth. Pop-radio chemistry.",
    language: "en",
    format: "pals",
    voiceIds: ["fa-sarah", "fa-charlie"],
    previewUrl: url("pals-en-3"),
  },

  // ---------- Panel (3 voices) — English ----------
  {
    id: "panel-en-1",
    label: "Paula, Sarah & Allie",
    description: "All-female panel. Warm host, sharp panelists.",
    language: "en",
    format: "panel",
    voiceIds: ["fa-paula", "fa-sarah", "fa-allie"],
    previewUrl: url("panel-en-1"),
  },
  {
    id: "panel-en-2",
    label: "Alex, Sarah & Charlie",
    description: "Friendly host, bright + smooth panelists.",
    language: "en",
    format: "panel",
    voiceIds: ["fa-alex", "fa-sarah", "fa-charlie"],
    previewUrl: url("panel-en-2"),
  },
  {
    id: "panel-en-3",
    label: "Charlie, Alex & Jim",
    description: "All-male panel. Smooth host, two distinct voices.",
    language: "en",
    format: "panel",
    voiceIds: ["fa-charlie", "fa-alex", "fa-jim"],
    previewUrl: url("panel-en-3"),
  },
];

export function voiceGroupsFor(
  format: VoiceGroupFormat,
  language: VoiceLanguage,
): VoiceGroup[] {
  return VOICE_GROUPS.filter(
    (g) => g.format === format && g.language === language,
  );
}

export const VOICE_GROUP_BY_ID: ReadonlyMap<string, VoiceGroup> = new Map(
  VOICE_GROUPS.map((g) => [g.id, g] as const),
);
