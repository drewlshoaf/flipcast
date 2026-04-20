# Flabbercast MVP Specification

## 1. Product Summary

**Product name:** Flabbercast  
**Domain:** `Flabbercast.com`  
**Positioning:** The world's first personalized on-demand podcast.

Flabbercast generates a short custom podcast episode in response to a user topic prompt. The product turns a topic into a three-person panel discussion with a moderator and two panelists, synthesizes speaker audio in selected voices, stitches the segments into a single MP3, and returns a finished playable podcast to the user.

## 2. MVP Goals

The MVP should prove that Flabbercast can:

- Accept a user topic and generation preferences from a public website
- Validate and moderate the request before generation
- Generate a structured transcript for a three-person panel
- Synthesize speaker-specific audio from transcript segments
- Stitch those segments into a final MP3 with correct pauses/timing
- Stream generation progress back to the browser in real time
- Provide immediate playback of the completed podcast
- Persist podcast history for authenticated users
- Support transcript-level ad insertion for ad-supported episodes

## 3. Core User Experience

### 3.1 Anonymous/Public User Flow

1. User lands on the Flabbercast homepage.
2. User enters a topic in a search-style prompt field.
3. User selects an approximate duration.
4. User selects three voices:
   - moderator voice
   - panelist one voice
   - panelist two voice
5. User submits the request.
6. Frontend opens or maintains an SSE connection for job progress.
7. Backend validates, moderates, queues, and processes the request.
8. User sees live status updates during generation.
9. When complete, the page shows a playable audio result.
10. User can play the MP3 directly on the site.

### 3.2 Authenticated User Flow

Authenticated users get everything above plus:

- login/account access
- saved history of topics submitted
- saved Flabbercasts generated
- playback history / replay access
- future subscription-based ad-free generation

## 4. Functional Requirements

## 4.1 Website / Frontend

**Framework:** Next.js

### MVP frontend requirements

- Public landing page
- Topic input field styled like a search bar
- Duration selector
- Three voice selectors
- Submit action
- Generation state UI
- Live status updates using SSE
- Inline audio player for completed results
- Error and moderation rejection states
- Login entry point
- Authenticated history page

### Frontend states

- idle
- validating
- moderated/rejected
- queued
- generating transcript
- synthesizing audio
- stitching audio
- complete
- failed

## 4.2 Request Moderation

Before transcript generation, the system must evaluate whether the prompt violates a configurable policy set.

### Moderation goals

- Prevent generation for banned or disallowed topics
- Support a configurable standards list
- Store moderation result and reason
- Return a user-facing rejection message when blocked

### Initial banned-topic classes

The banned list is configurable, but the initial spec should support categories such as:

- alcohol-related content
- drug-related content
- sexual content
- crime
- illegal activity
- unethical activity

### Moderation workflow

1. Receive user topic.
2. Normalize and validate the input.
3. Run policy evaluation.
4. Ask model and/or policy layer whether the request violates any configured standards.
5. If blocked:
   - persist moderation outcome
   - mark request as rejected
   - notify frontend
   - do not enqueue generation
6. If approved:
   - persist moderation outcome
   - continue to job creation

## 4.3 Transcript Generation

The system generates a transcript for a three-person podcast panel.

### Required transcript structure

- One moderator
- Two panelists
- A coherent conversation on the requested topic
- A total length that roughly matches the selected duration
- Speaker-labeled turns
- Segment boundaries suitable for text-to-speech generation
- Timing/pause metadata sufficient for later stitching

### Transcript requirements

- Conversation must be natural and coherent
- Moderator should guide the flow
- Panelists should have differentiated roles or perspectives
- Output should be structured, not just plain prose
- Output should be deterministic enough to split into speaker turns cleanly

### Duration handling

The user chooses an approximate target duration. The transcript generator must use that value to constrain transcript size.

Initial duration model may support options such as:

- Bite Size: ~3 minutes
- Mid Size: ~5 minutes
- Deep Dive: ~10 minutes

The exact names can remain configurable in UI copy, but backend should use normalized duration targets.

## 4.4 Voice Selection and TTS

The user selects three voices before generation. Each selected voice is bound to a speaker role.

### Voice mapping

- moderator -> selected voice A
- panelist_1 -> selected voice B
- panelist_2 -> selected voice C

### TTS requirements

- Each transcript segment is synthesized using the voice assigned to that speaker
- Synthesis engine currently assumed to be Coqui
- Each turn or snippet should produce an audio asset with metadata
- Failed synthesis should be retryable at the segment level if possible

## 4.5 Audio Stitching / Final MP3

After all segments are synthesized, the system must combine them into a single playable MP3.

### Stitching requirements

- Preserve speaker order
- Preserve intended pauses/timing
- Concatenate all synthesized snippets in transcript order
- Produce one final output file
- Attach output to the Flabbercast record
- Make the final audio immediately playable from the frontend

### Output requirements

- final MP3 file
- optional transcript persistence
- duration metadata
- generation metadata

## 4.6 Advertising Module

Advertising is part of the generated experience and must be inserted into the original transcript before synthesis.

### Advertising behavior

- Ads interrupt the cast at configured points
- Ad copy is spoken by the cast participants as part of the transcript
- Ad segment may include offer language and promo code
- Ad insertion should feel naturally integrated rather than post-produced

### Ad system requirements

- Support zero or one or multiple ad insertions per cast depending on policy/configuration
- Support ad scripts or ad prompts as inputs
- Tag ad segments in transcript metadata
- Persist ad usage metadata per Flabbercast
- Allow future disabling of ad insertion for paid users

### Subscription-aware behavior

- free tier: ads may be inserted
- paid tier: ad insertion disabled

## 4.7 Account and History

Although the site is initially public, the architecture should support accounts early.

### Account requirements

- sign up / login
- associate generated content with a user account
- show historical queries
- show generated Flabbercasts
- allow replay of historical Flabbercasts

### History page requirements

Each saved item should display at least:

- topic/query
- created timestamp
- selected duration
- selected voices
- generation status
- audio availability
- playback action

## 5. Non-Functional Requirements

## 5.1 Responsiveness

- API should acknowledge requests quickly
- Long-running work must happen asynchronously
- Frontend should show progress rather than block
- User should have strong visibility into current pipeline stage

## 5.2 Reliability

- Jobs must be persisted and inspectable
- Failures must have clear error states
- Workers should support retries for transient failures
- Partial artifacts should be traceable for debugging

## 5.3 Extensibility

System should be designed so the following can be added later without major redesign:

- subscription billing
- ad-free accounts
- more cast formats
- more voices
- more moderation categories
- admin tooling
- analytics/reporting
- recommendation/personalization
- sponsor management

## 5.4 Auditability

Store enough metadata to answer:

- who requested the cast
- what topic was requested
- whether it was moderated or rejected
- what transcript/version was used
- which voices were used
- whether ads were inserted
- where the output file is stored

## 6. Proposed Technical Architecture

## 6.1 Frontend

**Stack:** Next.js

Responsibilities:

- collect input
- collect duration
- collect voice selections
- submit request
- open/maintain SSE connection
- render live progress
- render moderation rejection or failure states
- render final player
- render user history when authenticated

## 6.2 API Layer

Responsibilities:

- validate request payload
- create request record
- run moderation pre-check
- reject blocked content early
- enqueue approved jobs
- expose SSE progress events
- expose history and playback metadata

Suggested API style:

- REST for submission/history/control
- SSE for one-way live progress streaming

## 6.3 Queue / Async Processing

**Queue choice:** BullMQ  
**Broker/backend:** Redis

Responsibilities:

- manage generation jobs
- isolate long-running processing from request/response path
- support retries and backoff
- expose deterministic pipeline stages

Suggested job stages:

1. validate_request
2. moderate_request
3. generate_transcript
4. insert_ads
5. split_transcript_segments
6. synthesize_segments
7. stitch_audio
8. persist_final_assets
9. mark_complete

## 6.4 Persistence

**Recommended primary database:** PostgreSQL

Why PostgreSQL:

- strong relational model for users, requests, transcripts, segments, ads, and assets
- reliable querying for history and audit trails
- good fit for transactional state changes

**Recommended cache/queue store:** Redis

### Storage responsibilities

**PostgreSQL**
- users
- Flabbercast requests/jobs
- moderation decisions
- transcript metadata
- segment metadata
- voice selections
- ad metadata
- output metadata

**Redis / BullMQ**
- queued work
- active job state
- retry state
- transient processing coordination

**Object storage**
- synthesized segment files
- final MP3 files
- optional transcript exports or derivatives

Object storage can be local in development and cloud-backed in production.

## 7. Proposed Data Model

## 7.1 User

Fields:

- id
- email
- password_hash or auth_provider metadata
- plan_tier
- created_at
- updated_at

## 7.2 FlabbercastRequest

Represents a single requested podcast generation.

Fields:

- id
- user_id nullable
- topic
- requested_duration_label
- requested_duration_seconds_target
- moderator_voice_id
- panelist_1_voice_id
- panelist_2_voice_id
- status
- moderation_status
- moderation_reason
- ads_enabled
- final_audio_url
- transcript_version
- error_message
- created_at
- updated_at
- completed_at

## 7.3 Transcript

Fields:

- id
- flabbercast_request_id
- raw_prompt_context
- generated_transcript_text
- structured_transcript_json
- ad_inserted boolean
- estimated_duration_seconds
- created_at

## 7.4 TranscriptSegment

Fields:

- id
- transcript_id
- sequence_number
- speaker_role
- speaker_name
- voice_id
- text
- pause_ms_after
- start_time_ms nullable
- end_time_ms nullable
- is_ad_segment boolean
- created_at

## 7.5 AudioAsset

Fields:

- id
- flabbercast_request_id
- transcript_segment_id nullable
- asset_type
- storage_url
- duration_ms
- created_at

## 7.6 ModerationDecision

Fields:

- id
- flabbercast_request_id
- input_text
- decision
- matched_policy_category
- model_reasoning_summary
- created_at

## 8. API Outline

## 8.1 Public/Authenticated Endpoints

### POST `/api/flabbercasts`
Create a new Flabbercast request.

Request body:

- topic
- duration
- moderator_voice_id
- panelist_1_voice_id
- panelist_2_voice_id

Response:

- request_id
- initial_status
- moderation_status if immediate
- sse_channel or correlation id

### GET `/api/flabbercasts/:id`
Return request details and status.

### GET `/api/flabbercasts/:id/stream`
SSE endpoint for live progress.

### GET `/api/me/flabbercasts`
Return authenticated user history.

### GET `/api/me/flabbercasts/:id`
Return saved item detail.

## 8.2 SSE Event Types

Suggested events:

- request_received
- moderation_started
- moderation_rejected
- moderation_approved
- queued
- transcript_generation_started
- transcript_generated
- ad_insertion_started
- ad_insertion_complete
- synthesis_started
- synthesis_progress
- stitching_started
- finalizing
- complete
- failed

Each event should include:

- request_id
- status
- stage
- percent optional
- message
- timestamp

## 9. Processing Pipeline Detail

## 9.1 End-to-End Pipeline

1. User submits topic, duration, and voices.
2. API validates payload.
3. API creates a request record.
4. Moderation layer evaluates the topic.
5. If rejected, request ends with rejection state.
6. If approved, a BullMQ job is created.
7. Worker generates a transcript for moderator + two panelists.
8. Ad module injects sponsored segment(s) when enabled.
9. Transcript is split into speaker-specific synthesis segments.
10. TTS generates per-segment audio files.
11. Audio stitching combines all segment files in order with pauses.
12. Final MP3 is stored.
13. Request record is updated to complete.
14. Frontend displays play button/player.

## 10. Error Handling

The system should distinguish between:

- validation errors
- moderation rejection
- model generation failure
- TTS synthesis failure
- audio stitching failure
- persistence/storage failure
- unexpected internal failure

### Error handling expectations

- preserve a user-friendly error message
- preserve an internal diagnostic error code
- preserve stage of failure
- allow retry paths for transient infrastructure issues

## 11. Security / Governance Considerations

Even in MVP form, the following should be accounted for:

- server-side validation of all request inputs
- moderation before generation
- authenticated access to history for logged-in users
- authorization checks for private history access
- rate limiting at API level
- safe storage access patterns for audio assets
- internal audit trail for moderation and output creation

## 12. Delivery Phasing

## Phase 1 - Core Vertical Slice

- Next.js public site
- topic input
- duration selector
- voice selectors
- request submission
- moderation pre-check
- BullMQ + Redis job pipeline
- transcript generation
- Coqui-based segment synthesis
- audio stitching
- SSE progress updates
- final MP3 playback

## Phase 2 - Accounts and History

- sign up / login
- associate requests with users
- history page
- replay past Flabbercasts

## Phase 3 - Advertising Module

- transcript-level ad insertion
- ad metadata persistence
- sponsor/promo code support
- ad display/admin controls later

## Phase 4 - Paid Tier Readiness

- plan tier flags
- disable ads for paid users
- groundwork for billing integration

## 13. Open Design Decisions

These are not blockers to drafting the architecture, but they must be finalized during implementation planning:

- final duration option names and exact target lengths
- exact model/provider for transcript generation
- exact Coqui deployment/interface pattern
- transcript JSON schema for speaker turns and timing
- exact audio stitching library/tool choice
- auth implementation approach
- storage provider for production audio assets
- advertising rule engine design
- moderation taxonomy and policy administration UX

## 14. Recommended Build Principles

- Keep the frontend simple and extremely clear.
- Keep the pipeline stateful and inspectable.
- Favor structured transcript output over loose prose.
- Treat moderation as a required entry gate.
- Treat ad insertion as transcript composition, not post-production patchwork.
- Design for retries and observability from day one.
- Ship a real end-to-end slice before expanding feature breadth.

## 15. MVP Definition of Done

The MVP is done when a user can:

1. visit the public site
2. enter a topic
3. select a duration
4. select three voices
5. submit a request
6. see live progress updates
7. receive a moderation rejection when appropriate
8. receive a completed personalized panel podcast when approved
9. play that podcast directly in the browser
10. log in and revisit previously generated Flabbercasts

