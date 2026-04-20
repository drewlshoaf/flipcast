export const SSE_EVENTS = [
  "request_received",
  "moderation_started",
  "moderation_rejected",
  "moderation_approved",
  "queued",
  "setup_started",
  "setup_complete",
  "welcome_synth_started",
  "welcome_ready",
  "scene_generation_started",
  "scene_synth_started",
  "scene_ready",
  "complete",
  "failed",
] as const;
export type SseEventName = (typeof SSE_EVENTS)[number];

export interface SseEvent {
  event: SseEventName;
  requestId: string;
  stage?: string;
  percent?: number;
  message?: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export const sseChannel = (requestId: string) =>
  `flipcast:events:${requestId}`;
