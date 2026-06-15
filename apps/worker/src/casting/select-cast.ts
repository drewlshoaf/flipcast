// Cast selection. Given (format × lean × resolvedVibe), pick one of the
// pre-approved groups from APPROVED_CAST_GROUPS.
//
// Tier preference:
//   1. Groups whose primaryVibe === resolvedVibe (best fit)
//   2. Groups whose secondaryVibes includes resolvedVibe (acceptable fit)
//   3. All groups in the (format × lean) bucket regardless of vibe
//      (last-resort fallback so we never throw)
//
// Within a tier, rotation is deterministic-by-default: a hash of the
// requestId picks an index modulo the tier size. Same request always
// gets the same cast; different requests get spread evenly. This is the
// "variation comes from interpretation, not hidden randomness or reuse
// bias" rule from the spec.

import {
  castGroupsForVibe,
  castGroupsFor,
  type ApprovedCastGroup,
  type Lean,
  type ShowbizFormat,
  type Vibe,
} from "@flipcast/types";

export interface CastSelection {
  group: ApprovedCastGroup;
  // Which tier the chosen group came from. Useful in logs to spot when
  // we're falling back to weaker matches.
  tier: "primary" | "secondary" | "fallback";
  reason: string;
}

// 32-bit FNV-1a hash. Stable + fast + works on any string. Used for
// deterministic rotation across requestIds without needing an RNG.
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Force unsigned 32-bit.
  return h >>> 0;
}

export function selectCast(args: {
  format: ShowbizFormat;
  lean: Lean;
  resolvedVibe: Vibe;
  // Used as the rotation seed so the same request always lands the same
  // group. Pass any stable per-episode string (typically the requestId).
  rotationSeed: string;
}): CastSelection {
  const { format, lean, resolvedVibe, rotationSeed } = args;
  const { primary, secondary } = castGroupsForVibe(format, lean, resolvedVibe);
  const seed = hashString(rotationSeed);

  if (primary.length > 0) {
    const pick = primary[seed % primary.length]!;
    return {
      group: pick,
      tier: "primary",
      reason: `primary-vibe match (${primary.length} candidates)`,
    };
  }
  if (secondary.length > 0) {
    const pick = secondary[seed % secondary.length]!;
    return {
      group: pick,
      tier: "secondary",
      reason: `secondary-vibe match (${secondary.length} candidates) — no primary-vibe group available`,
    };
  }

  // Fallback: any group in the (format × lean) bucket.
  const all = castGroupsFor(format, lean);
  if (all.length === 0) {
    throw new Error(
      `selectCast: no approved groups for format=${format} lean=${lean} (data integrity issue)`,
    );
  }
  const pick = all[seed % all.length]!;
  return {
    group: pick,
    tier: "fallback",
    reason: `no vibe match for ${resolvedVibe}; fell back to any (${format}, ${lean}) group`,
  };
}
