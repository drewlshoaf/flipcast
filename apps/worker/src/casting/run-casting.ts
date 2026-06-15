// Casting orchestrator. One entry point per episode:
//   inference (Haiku) → moderation gate → vibe resolution → format
//   selection → cast selection
//
// Returns a CastingResult that describes every decision the system
// made, including the chosen ApprovedCastGroup (or a moderation
// rejection). The worker pipeline persists this result to the
// transcript record + emits the chosen cast to the studio.

import {
  characterById,
  type CastingResult,
  type Lean,
  type Vibe,
} from "@flipcast/types";
import { inferShowbizEpisode } from "./inference";
import { evaluateModeration } from "./moderation";
import { resolveVibe } from "./resolve-vibe";
import { selectFormat } from "./select-format";
import { selectCast } from "./select-cast";

export interface RunCastingArgs {
  topic: string;
  requestedVibe: Vibe;
  lean: Lean;
  // Stable per-episode string used as the deterministic rotation seed
  // for cast selection (so the same request always lands the same cast).
  // Typically the requestId.
  rotationSeed: string;
}

export async function runCasting(
  args: RunCastingArgs,
): Promise<CastingResult> {
  const { inference, durationMs } = await inferShowbizEpisode({
    topic: args.topic,
  });

  // Moderation gate. When rejected, we return early with the inference
  // result + reason but no vibe/format/cast selections.
  const moderation = evaluateModeration({ topic: args.topic, inference });
  if (!moderation.allowed) {
    return {
      topic: args.topic,
      requestedVibe: args.requestedVibe,
      lean: args.lean,
      inference,
      moderation,
      inferenceDurationMs: durationMs,
    };
  }

  // Vibe resolution + format + cast.
  const vibeResolution = resolveVibe({
    requestedVibe: args.requestedVibe,
    inference,
  });
  const formatDecision = selectFormat({
    resolvedVibe: vibeResolution.resolvedVibe,
    inference,
  });
  const castSelection = selectCast({
    format: formatDecision.format,
    lean: args.lean,
    resolvedVibe: vibeResolution.resolvedVibe,
    rotationSeed: args.rotationSeed,
  });

  // Convenience copy of the selected character IDs in seat order. The
  // Phase 2C generatePresetCastSetup call resolves these to full
  // RosterCharacter objects.
  const selectedCharacterIds = castSelection.group.members.slice();

  // Defensive: every member id must resolve. The cast-groupings
  // self-check already validates this at module load, but a runtime
  // assert here gives a clean error message if data drifts.
  for (const id of selectedCharacterIds) {
    if (!characterById(id)) {
      throw new Error(
        `runCasting: chosen group ${castSelection.group.id} references unknown character "${id}"`,
      );
    }
  }

  return {
    topic: args.topic,
    requestedVibe: args.requestedVibe,
    lean: args.lean,
    inference,
    moderation,
    vibeResolution,
    selectedFormat: formatDecision.format,
    selectedGroupId: castSelection.group.id,
    selectedGroup: castSelection.group,
    selectedCharacterIds,
    inferenceDurationMs: durationMs,
  };
}

// Compact one-line log summary of a casting result. Useful at the
// pipeline log site so admins can see every decision in one tail.
export function summarizeCastingResult(r: CastingResult): string {
  const parts: string[] = [];
  parts.push(`topic="${r.topic.slice(0, 60)}${r.topic.length > 60 ? "…" : ""}"`);
  parts.push(`vibe=${r.requestedVibe}`);
  parts.push(`lean=${r.lean}`);
  parts.push(`sens=${r.inference.topic_sensitivity}`);
  if (r.inference.topic_subtype) parts.push(`subtype=${r.inference.topic_subtype}`);
  parts.push(`disc=${r.inference.discussion_value}`);
  parts.push(`complex=${r.inference.topic_complexity}`);
  if (!r.moderation.allowed) {
    parts.push(`REJECTED:${r.moderation.reasonCode}`);
    return parts.join(" | ");
  }
  if (r.vibeResolution?.adjustmentApplied) {
    parts.push(
      `adjusted=${r.vibeResolution.requestedVibe}→${r.vibeResolution.resolvedVibe}(${r.vibeResolution.adjustmentReasonCode})`,
    );
  } else {
    parts.push(`resolved=${r.vibeResolution?.resolvedVibe}`);
  }
  parts.push(`fmt=${r.selectedFormat}`);
  parts.push(`cast=${r.selectedGroupId}`);
  return parts.join(" | ");
}
