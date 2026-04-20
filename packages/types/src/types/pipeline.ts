import { z } from "zod";
import {
  MIN_LENGTH_MINUTES,
  MAX_LENGTH_MINUTES,
  MIN_SPEED,
  MAX_SPEED,
  VIBE_IDS,
} from "../voices";

export const PIPELINE_STAGES = [
  "validate_request",
  "moderate_request",
  "setup",
  "synthesize_welcome",
  "generate_scene",
  "synthesize_scene",
  "mark_complete",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const speakerRoles = ["moderator", "panelist_1", "panelist_2"] as const;
export type SpeakerRole = (typeof speakerRoles)[number];

export const characterSchema = z.object({
  role: z.enum(speakerRoles),
  name: z.string().min(1),
  voiceId: z.string().min(1),
  voiceLabel: z.string().min(1),
  persona: z.string().min(1),
  bio: z.string().optional(),
  gender: z.enum(["male", "female", "neutral"]).optional(),
  ethnicity: z.string().optional(),
});
export type Character = z.infer<typeof characterSchema>;

export const sceneOutlineSchema = z.object({
  sceneIndex: z.number().int().min(1),
  focus: z.string().min(1),
  targetSeconds: z.number().int().positive(),
});
export type SceneOutline = z.infer<typeof sceneOutlineSchema>;

export const episodeSetupSchema = z.object({
  topicContext: z.string().min(1),
  panelists: z.array(characterSchema).min(1).max(3),
  welcomeText: z.string().min(1),
  outline: z.array(sceneOutlineSchema).min(2),
});
export type EpisodeSetup = z.infer<typeof episodeSetupSchema>;

export const transcriptTurnSchema = z.object({
  sequence: z.number().int().nonnegative(),
  speaker: z.enum(speakerRoles),
  text: z.string().min(1),
  pauseMsAfter: z.number().int().nonnegative().default(150),
  isAd: z.boolean().default(false),
});
export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;

// Vibe + format enums for request validation.
const vibeValues = VIBE_IDS as readonly string[];
const vibeEnum = z.custom<(typeof VIBE_IDS)[number]>(
  (val) => typeof val === "string" && vibeValues.includes(val),
  { message: "Unknown vibe" },
);

export const createRequestSchema = z.object({
  topic: z.string().trim().min(3).max(500),
  format: z.enum(["panel", "newscast"]),
  vibe: vibeEnum,
  lengthMinutes: z.number().min(MIN_LENGTH_MINUTES).max(MAX_LENGTH_MINUTES),
  voiceIds: z.array(z.string().min(1)).optional(),
  speed: z.number().min(MIN_SPEED).max(MAX_SPEED).optional(),
});
export type CreateRequestInput = z.infer<typeof createRequestSchema>;
