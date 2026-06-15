// V1 approved cast groupings. Hand-curated named slots — runtime
// selection (Phase 2) chooses from this table rather than assembling raw
// characters ad hoc. Source of truth: the casting spec answers (Section
// 3 / "Approved first-cut grouping direction").
//
// Each group declares its primary vibe and secondary vibes. The selector
// matches strictly on (lean × format) and prefers groups whose primary
// vibe equals the requested vibe; falls back to secondaryVibes membership
// before widening.

import type { Lean, ShowbizFormat, Vibe } from "./showbiz";
import { characterById } from "./characters";

// One unified shape per the spec: { group_id, format, lean, primary_vibe,
// secondary_vibes, members, host_id if panel, notes }. Members ordering:
//   solo  → [characterId]
//   pals  → [characterIdA, characterIdB]   (peer roles, order is editorial)
//   panel → [hostId, panelistId1, panelistId2]   (host always first)
export interface ApprovedCastGroup {
  id: string;
  format: ShowbizFormat;
  lean: Lean;
  primaryVibe: Vibe;
  secondaryVibes: readonly Vibe[];
  members: readonly string[];
  // Set only for format=panel; equals members[0]. Exposed separately so
  // selection logic does not have to slice() to get the host.
  hostId?: string;
  notes?: string;
}

// ============================================================
//  Solo groups
// ============================================================
//
// Each named slot is a single character pre-tagged with its primary +
// secondary vibe fit. Mixed-lean solo selection pulls from BOTH the
// feminine and masculine pools and picks the best fit for the requested
// vibe — there are no separate "mixed" solo groups.
const SOLO_GROUPS: readonly ApprovedCastGroup[] = [
  // Feminine solo pool
  { id: "S-F-1", format: "solo", lean: "feminine", primaryVibe: "warm",    secondaryVibes: ["smart"],   members: ["tess-rowan"] },
  { id: "S-F-2", format: "solo", lean: "feminine", primaryVibe: "serious", secondaryVibes: ["smart"],   members: ["simone-avery"] },
  { id: "S-F-3", format: "solo", lean: "feminine", primaryVibe: "smart",   secondaryVibes: ["serious"], members: ["sera-whitlock"] },
  { id: "S-F-4", format: "solo", lean: "feminine", primaryVibe: "fun",     secondaryVibes: ["warm"],    members: ["chloe-bennett"] },

  // Masculine solo pool
  { id: "S-M-1", format: "solo", lean: "masculine", primaryVibe: "smart",   secondaryVibes: ["serious"], members: ["adrian-cole"] },
  { id: "S-M-2", format: "solo", lean: "masculine", primaryVibe: "serious", secondaryVibes: ["smart"],   members: ["damon-pierce"] },
  { id: "S-M-3", format: "solo", lean: "masculine", primaryVibe: "smart",   secondaryVibes: ["warm"],    members: ["owen-mercer"] },
  { id: "S-M-4", format: "solo", lean: "masculine", primaryVibe: "smart",   secondaryVibes: ["warm"],    members: ["caleb-rowan"] },
  { id: "S-M-5", format: "solo", lean: "masculine", primaryVibe: "fun",     secondaryVibes: ["smart"],   members: ["ethan-vale"] },
  { id: "S-M-6", format: "solo", lean: "masculine", primaryVibe: "serious", secondaryVibes: ["smart"],   members: ["graham-ellis"] },
];

// ============================================================
//  Pals groups (2 equal voices)
// ============================================================
//
// Pals deliberately support Fun / Warm / Smart only. Per spec §8.2,
// Serious requests should route to Solo or Panel rather than Pals — the
// Phase 2 format-selector handles that routing.
const PALS_GROUPS: readonly ApprovedCastGroup[] = [
  // Feminine pals (FF)
  { id: "P-FF-1", format: "pals", lean: "feminine", primaryVibe: "warm", secondaryVibes: ["fun"], members: ["lena-brooks", "chloe-bennett"] },
  { id: "P-FF-2", format: "pals", lean: "feminine", primaryVibe: "warm", secondaryVibes: ["fun"], members: ["lena-brooks", "ivy-monroe"] },
  { id: "P-FF-3", format: "pals", lean: "feminine", primaryVibe: "fun",  secondaryVibes: [],      members: ["chloe-bennett", "ivy-monroe"] },

  // Masculine pals (MM)
  { id: "P-MM-1", format: "pals", lean: "masculine", primaryVibe: "warm",  secondaryVibes: ["smart"], members: ["caleb-rowan", "noah-bishop"] },
  { id: "P-MM-2", format: "pals", lean: "masculine", primaryVibe: "smart", secondaryVibes: ["fun"],   members: ["caleb-rowan", "ethan-vale"] },
  { id: "P-MM-3", format: "pals", lean: "masculine", primaryVibe: "fun",   secondaryVibes: ["warm"],  members: ["ethan-vale", "noah-bishop"] },
  { id: "P-MM-4", format: "pals", lean: "masculine", primaryVibe: "smart", secondaryVibes: ["warm"],  members: ["owen-mercer", "caleb-rowan"] },
  { id: "P-MM-5", format: "pals", lean: "masculine", primaryVibe: "warm",  secondaryVibes: ["smart"], members: ["owen-mercer", "noah-bishop"] },
  { id: "P-MM-6", format: "pals", lean: "masculine", primaryVibe: "smart", secondaryVibes: ["fun"],   members: ["owen-mercer", "ethan-vale"] },

  // Mixed pals (FM)
  { id: "P-FM-1", format: "pals", lean: "mixed", primaryVibe: "warm",  secondaryVibes: ["smart"], members: ["lena-brooks", "caleb-rowan"] },
  { id: "P-FM-2", format: "pals", lean: "mixed", primaryVibe: "fun",   secondaryVibes: ["smart"], members: ["chloe-bennett", "caleb-rowan"] },
  { id: "P-FM-3", format: "pals", lean: "mixed", primaryVibe: "warm",  secondaryVibes: ["fun"],   members: ["chloe-bennett", "noah-bishop"] },
  { id: "P-FM-4", format: "pals", lean: "mixed", primaryVibe: "smart", secondaryVibes: ["fun"],   members: ["ivy-monroe", "owen-mercer"] },
  { id: "P-FM-5", format: "pals", lean: "mixed", primaryVibe: "warm",  secondaryVibes: ["smart"], members: ["lena-brooks", "owen-mercer"] },
  { id: "P-FM-6", format: "pals", lean: "mixed", primaryVibe: "fun",   secondaryVibes: ["smart"], members: ["chloe-bennett", "owen-mercer"] },
  { id: "P-FM-7", format: "pals", lean: "mixed", primaryVibe: "smart", secondaryVibes: ["fun"],   members: ["ivy-monroe", "caleb-rowan"] },
  { id: "P-FM-8", format: "pals", lean: "mixed", primaryVibe: "warm",  secondaryVibes: ["fun"],   members: ["lena-brooks", "ethan-vale"] },
];

// ============================================================
//  Panel groups (1 host + 2 panelists)
// ============================================================
//
// Mixed-lean panels are split by host gender (PN-MXF = feminine host,
// PN-MXM = masculine host) so Phase 2 selection can prefer one or the
// other when a request would benefit from a particular host energy.
// Both subsets satisfy lean=mixed.
const PANEL_GROUPS: readonly ApprovedCastGroup[] = [
  // Feminine panels (FFF)
  { id: "PN-FFF-1", format: "panel", lean: "feminine", primaryVibe: "smart",   secondaryVibes: ["serious", "warm"], members: ["elena-vale", "tess-rowan", "simone-avery"], hostId: "elena-vale" },
  { id: "PN-FFF-2", format: "panel", lean: "feminine", primaryVibe: "serious", secondaryVibes: ["smart"],           members: ["nadia-cross", "simone-avery", "sera-whitlock"], hostId: "nadia-cross" },
  { id: "PN-FFF-3", format: "panel", lean: "feminine", primaryVibe: "smart",   secondaryVibes: ["warm"],            members: ["mara-quinn", "ivy-monroe", "tess-rowan"], hostId: "mara-quinn" },
  { id: "PN-FFF-4", format: "panel", lean: "feminine", primaryVibe: "smart",   secondaryVibes: ["fun"],             members: ["elena-vale", "ivy-monroe", "sera-whitlock"], hostId: "elena-vale" },
  { id: "PN-FFF-5", format: "panel", lean: "feminine", primaryVibe: "smart",   secondaryVibes: ["serious"],         members: ["mara-quinn", "simone-avery", "tess-rowan"], hostId: "mara-quinn" },

  // Masculine panels (MMM)
  { id: "PN-MMM-1", format: "panel", lean: "masculine", primaryVibe: "smart",   secondaryVibes: [],          members: ["julian-hart", "adrian-cole", "owen-mercer"], hostId: "julian-hart" },
  { id: "PN-MMM-2", format: "panel", lean: "masculine", primaryVibe: "serious", secondaryVibes: [],          members: ["marcus-reed", "damon-pierce", "graham-ellis"], hostId: "marcus-reed" },
  { id: "PN-MMM-3", format: "panel", lean: "masculine", primaryVibe: "smart",   secondaryVibes: ["serious"], members: ["julian-hart", "owen-mercer", "damon-pierce"], hostId: "julian-hart" },
  { id: "PN-MMM-4", format: "panel", lean: "masculine", primaryVibe: "serious", secondaryVibes: ["smart"],   members: ["marcus-reed", "adrian-cole", "graham-ellis"], hostId: "marcus-reed" },
  { id: "PN-MMM-5", format: "panel", lean: "masculine", primaryVibe: "smart",   secondaryVibes: ["serious"], members: ["julian-hart", "adrian-cole", "damon-pierce"], hostId: "julian-hart" },

  // Mixed panels — feminine host (MXF)
  { id: "PN-MXF-1", format: "panel", lean: "mixed", primaryVibe: "smart",   secondaryVibes: ["warm"],              members: ["elena-vale", "tess-rowan", "adrian-cole"], hostId: "elena-vale" },
  { id: "PN-MXF-2", format: "panel", lean: "mixed", primaryVibe: "serious", secondaryVibes: ["smart"],             members: ["nadia-cross", "simone-avery", "owen-mercer"], hostId: "nadia-cross" },
  { id: "PN-MXF-3", format: "panel", lean: "mixed", primaryVibe: "smart",   secondaryVibes: ["fun"],               members: ["mara-quinn", "ivy-monroe", "adrian-cole"], hostId: "mara-quinn" },
  { id: "PN-MXF-4", format: "panel", lean: "mixed", primaryVibe: "smart",   secondaryVibes: [],                    members: ["elena-vale", "sera-whitlock", "owen-mercer"], hostId: "elena-vale" },
  { id: "PN-MXF-5", format: "panel", lean: "mixed", primaryVibe: "smart",   secondaryVibes: ["warm", "serious"],   members: ["mara-quinn", "tess-rowan", "damon-pierce"], hostId: "mara-quinn" },

  // Mixed panels — masculine host (MXM)
  { id: "PN-MXM-1", format: "panel", lean: "mixed", primaryVibe: "smart",   secondaryVibes: ["warm"],    members: ["julian-hart", "adrian-cole", "tess-rowan"], hostId: "julian-hart" },
  { id: "PN-MXM-2", format: "panel", lean: "mixed", primaryVibe: "serious", secondaryVibes: [],          members: ["marcus-reed", "damon-pierce", "sera-whitlock"], hostId: "marcus-reed" },
  { id: "PN-MXM-3", format: "panel", lean: "mixed", primaryVibe: "smart",   secondaryVibes: ["fun"],     members: ["julian-hart", "owen-mercer", "ivy-monroe"], hostId: "julian-hart" },
  { id: "PN-MXM-4", format: "panel", lean: "mixed", primaryVibe: "serious", secondaryVibes: ["smart"],   members: ["marcus-reed", "graham-ellis", "simone-avery"], hostId: "marcus-reed" },
  { id: "PN-MXM-5", format: "panel", lean: "mixed", primaryVibe: "smart",   secondaryVibes: ["serious"], members: ["julian-hart", "damon-pierce", "tess-rowan"], hostId: "julian-hart" },
];

// Single flat list — what Phase 2 actually filters against.
export const APPROVED_CAST_GROUPS: readonly ApprovedCastGroup[] = [
  ...SOLO_GROUPS,
  ...PALS_GROUPS,
  ...PANEL_GROUPS,
];

export const CAST_GROUP_BY_ID: ReadonlyMap<string, ApprovedCastGroup> =
  new Map(APPROVED_CAST_GROUPS.map((g) => [g.id, g] as const));

// ============================================================
//  Lookup helpers
// ============================================================

export function castGroupById(id: string): ApprovedCastGroup | undefined {
  return CAST_GROUP_BY_ID.get(id);
}

export function castGroupsFor(
  format: ShowbizFormat,
  lean: Lean,
): readonly ApprovedCastGroup[] {
  // Solo + mixed widens to the union of feminine + masculine solo groups —
  // a solo show is one person, who is necessarily F or M, so "mixed" can't
  // be its own bucket. See the SOLO_GROUPS header note for the design.
  if (format === "solo" && lean === "mixed") {
    return APPROVED_CAST_GROUPS.filter((g) => g.format === "solo");
  }
  return APPROVED_CAST_GROUPS.filter(
    (g) => g.format === format && g.lean === lean,
  );
}

// Vibe-aware view: returns groups whose primary OR secondary vibe matches.
// Phase 2 selection should prefer primary matches first; this helper
// returns both classes so the caller can rank.
export function castGroupsForVibe(
  format: ShowbizFormat,
  lean: Lean,
  vibe: Vibe,
): {
  primary: ApprovedCastGroup[];
  secondary: ApprovedCastGroup[];
} {
  const pool = castGroupsFor(format, lean);
  const primary = pool.filter((g) => g.primaryVibe === vibe);
  const secondary = pool.filter(
    (g) => g.primaryVibe !== vibe && g.secondaryVibes.includes(vibe),
  );
  return { primary, secondary };
}

// ============================================================
//  Integrity self-check (runs at module load)
// ============================================================
//
// Every member ID must exist in the roster. Members per format must be
// the right count. Panel hostId must equal members[0] and must carry
// the moderator role; panelists must carry the panelist role; pals
// members must carry the pal role; solo members must carry the solo
// role. Fail loudly if the data drifts.

function selfCheck(): void {
  const seenIds = new Set<string>();
  for (const g of APPROVED_CAST_GROUPS) {
    if (seenIds.has(g.id)) {
      throw new Error(`ApprovedCastGroup duplicate id "${g.id}"`);
    }
    seenIds.add(g.id);

    // Member count by format
    const expectedSize =
      g.format === "solo" ? 1 : g.format === "pals" ? 2 : 3;
    if (g.members.length !== expectedSize) {
      throw new Error(
        `Group ${g.id}: format ${g.format} expects ${expectedSize} members, got ${g.members.length}`,
      );
    }

    // hostId mirrors members[0] for panels; absent for solo/pals
    if (g.format === "panel") {
      if (!g.hostId) {
        throw new Error(`Panel ${g.id}: missing hostId`);
      }
      if (g.hostId !== g.members[0]) {
        throw new Error(
          `Panel ${g.id}: hostId "${g.hostId}" must equal members[0] "${g.members[0]}"`,
        );
      }
    } else if (g.hostId !== undefined) {
      throw new Error(
        `Group ${g.id}: hostId only valid for panel format`,
      );
    }

    // Member existence + role eligibility
    g.members.forEach((cid, i) => {
      const c = characterById(cid);
      if (!c) {
        throw new Error(`Group ${g.id}: unknown characterId "${cid}"`);
      }
      if (g.format === "solo" && !c.roles.includes("solo")) {
        throw new Error(`Group ${g.id}: "${cid}" lacks solo role`);
      }
      if (g.format === "pals" && !c.roles.includes("pal")) {
        throw new Error(`Group ${g.id}: "${cid}" lacks pal role`);
      }
      if (g.format === "panel") {
        if (i === 0 && !c.roles.includes("moderator")) {
          throw new Error(`Group ${g.id}: host "${cid}" lacks moderator role`);
        }
        if (i > 0 && !c.roles.includes("panelist")) {
          throw new Error(`Group ${g.id}: panelist "${cid}" lacks panelist role`);
        }
      }
    });

    // Members must not duplicate within a group
    if (new Set(g.members).size !== g.members.length) {
      throw new Error(`Group ${g.id}: duplicate member`);
    }

    // Lean composition sanity (best-effort gender check). Mixed allows
    // both; feminine = all female; masculine = all male.
    if (g.lean !== "mixed") {
      const expectedGender = g.lean === "feminine" ? "female" : "male";
      for (const cid of g.members) {
        const c = characterById(cid)!;
        if (c.gender !== expectedGender) {
          throw new Error(
            `Group ${g.id}: lean=${g.lean} expects all ${expectedGender}; "${cid}" is ${c.gender}`,
          );
        }
      }
    }
  }
}

selfCheck();
