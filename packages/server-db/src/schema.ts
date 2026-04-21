import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  boolean,
  jsonb,
  real,
  pgEnum,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const planTierEnum = pgEnum("plan_tier", ["free", "paid"]);

export const requestStatusEnum = pgEnum("request_status", [
  "pending",
  "validating",
  "moderating",
  "rejected",
  "queued",
  "generating_transcript",
  "inserting_ads",
  "synthesizing",
  "stitching",
  "finalizing",
  "complete",
  "failed",
]);

export const moderationStatusEnum = pgEnum("moderation_status", [
  "pending",
  "approved",
  "rejected",
]);

export const speakerRoleEnum = pgEnum("speaker_role", [
  "moderator",
  "panelist_1",
  "panelist_2",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true, mode: "date" }),
  name: text("name"),
  image: text("image"),
  passwordHash: text("password_hash"),
  planTier: planTierEnum("plan_tier").notNull().default("free"),
  isAdmin: boolean("is_admin").notNull().default(false),
  interests: text("interests").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Ad inventory served dynamically per playback so replays get fresh ads,
// optionally targeted by user interests.
export const ads = pgTable("ads", {
  id: uuid("id").defaultRandom().primaryKey(),
  product: text("product").notNull(),
  voiceId: text("voice_id").notNull(),
  audioUrl: text("audio_url").notNull(),
  durationSeconds: integer("duration_seconds").notNull().default(25),
  interests: text("interests").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Auth.js account linkage — one row per OAuth provider account connected to a user.
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const flipcastRequests = pgTable("flipcast_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  topic: text("topic").notNull(),
  requestedDurationLabel: text("requested_duration_label").notNull(),
  requestedDurationSecondsTarget: integer(
    "requested_duration_seconds_target",
  ).notNull(),
  moderatorVoiceId: text("moderator_voice_id"),
  panelist1VoiceId: text("panelist_1_voice_id"),
  panelist2VoiceId: text("panelist_2_voice_id"),
  engine: text("engine").notNull().default("neural"),
  format: text("format").notNull().default("panel"),
  vibe: text("vibe"),
  speed: real("speed"),
  status: requestStatusEnum("status").notNull().default("pending"),
  moderationStatus: moderationStatusEnum("moderation_status")
    .notNull()
    .default("pending"),
  moderationReason: text("moderation_reason"),
  adsEnabled: boolean("ads_enabled").notNull().default(true),
  finalAudioUrl: text("final_audio_url"),
  topicContext: text("topic_context"),
  welcomeText: text("welcome_text"),
  welcomeAudioUrl: text("welcome_audio_url"),
  scene1AudioUrl: text("scene_1_audio_url"),
  scene2AudioUrl: text("scene_2_audio_url"),
  scene3AudioUrl: text("scene_3_audio_url"),
  scene4AudioUrl: text("scene_4_audio_url"),
  transcriptVersion: integer("transcript_version"),
  errorMessage: text("error_message"),
  claudeUsage: jsonb("claude_usage"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const transcripts = pgTable("transcripts", {
  id: uuid("id").defaultRandom().primaryKey(),
  flipcastRequestId: uuid("flipcast_request_id")
    .notNull()
    .references(() => flipcastRequests.id, { onDelete: "cascade" }),
  rawPromptContext: jsonb("raw_prompt_context").notNull(),
  generatedTranscriptText: text("generated_transcript_text").notNull(),
  structuredTranscriptJson: jsonb("structured_transcript_json").notNull(),
  characters: jsonb("characters"),
  adInserted: boolean("ad_inserted").notNull().default(false),
  estimatedDurationSeconds: integer("estimated_duration_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const transcriptSegments = pgTable("transcript_segments", {
  id: uuid("id").defaultRandom().primaryKey(),
  transcriptId: uuid("transcript_id")
    .notNull()
    .references(() => transcripts.id, { onDelete: "cascade" }),
  sequenceNumber: integer("sequence_number").notNull(),
  sceneIndex: integer("scene_index"),
  speakerRole: speakerRoleEnum("speaker_role").notNull(),
  speakerName: text("speaker_name"),
  voiceId: text("voice_id").notNull(),
  text: text("text").notNull(),
  pauseMsAfter: integer("pause_ms_after").notNull().default(300),
  startTimeMs: integer("start_time_ms"),
  endTimeMs: integer("end_time_ms"),
  isAdSegment: boolean("is_ad_segment").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const audioAssets = pgTable("audio_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  flipcastRequestId: uuid("flipcast_request_id")
    .notNull()
    .references(() => flipcastRequests.id, { onDelete: "cascade" }),
  transcriptSegmentId: uuid("transcript_segment_id").references(
    () => transcriptSegments.id,
    { onDelete: "cascade" },
  ),
  assetType: text("asset_type").notNull(), // segment | scene | welcome | final
  sceneIndex: integer("scene_index"),
  storageUrl: text("storage_url").notNull(),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const moderationDecisions = pgTable("moderation_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  flipcastRequestId: uuid("flipcast_request_id")
    .notNull()
    .references(() => flipcastRequests.id, { onDelete: "cascade" }),
  inputText: text("input_text").notNull(),
  decision: moderationStatusEnum("decision").notNull(),
  matchedPolicyCategory: text("matched_policy_category"),
  modelReasoningSummary: text("model_reasoning_summary"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  requests: many(flipcastRequests),
}));

export const flipcastRequestsRelations = relations(
  flipcastRequests,
  ({ one, many }) => ({
    user: one(users, {
      fields: [flipcastRequests.userId],
      references: [users.id],
    }),
    transcript: one(transcripts),
    audioAssets: many(audioAssets),
    moderationDecisions: many(moderationDecisions),
  }),
);

export const transcriptsRelations = relations(transcripts, ({ one, many }) => ({
  request: one(flipcastRequests, {
    fields: [transcripts.flipcastRequestId],
    references: [flipcastRequests.id],
  }),
  segments: many(transcriptSegments),
}));

export const transcriptSegmentsRelations = relations(
  transcriptSegments,
  ({ one, many }) => ({
    transcript: one(transcripts, {
      fields: [transcriptSegments.transcriptId],
      references: [transcripts.id],
    }),
    audioAssets: many(audioAssets),
  }),
);
