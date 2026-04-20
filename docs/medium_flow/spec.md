# Personalized On-Demand Podcast Flow Specification

## 1. Purpose

This specification defines the end-to-end listener experience and backend orchestration model for a personalized, on-demand podcast product where a user submits a topic and receives a dynamically generated, panel-style podcast broken into scenes and separated by ad slots.

The primary objective is to reduce perceived wait time, give the backend generation windows during playback, and create a structured show format that feels deliberate and polished.

## 2. Product Intent

When the user submits a prompt and requests a podcast, the system should begin playback quickly using pre-created and lightweight generated audio while the backend prepares deeper content.

The show should feel like a produced experience, not a loading screen. Ads and interstitials are part of both the business model and the orchestration strategy.

## 3. Core User Flow

### User action

The user enters a topic or concept for the podcast and clicks **Generate**.

### Immediate result

Playback starts with a 20-second pre-created static advertisement.

### Backend work during early playback

While the first ad is playing, the backend should perform initial topic setup and generate the welcome/interstitial content.

## 4. Required Playback Sequence

The complete playback sequence is:

1. **Ad 1** — 20 seconds
2. **Welcome message** — generated spoken segment
3. **Ad 2** — 20 seconds
4. **Ad 3** — 20 seconds
5. **Scene 1** — 90 seconds
6. **Ad 4** — 20 seconds
7. **Scene 2** — 90 seconds
8. **Ad 5** — 20 seconds
9. **Scene 3** — 90 seconds
10. **Ad 6** — 20 seconds
11. **Scene 4** — 30 seconds

## 5. Timing Rules

### Ad durations

All ads are exactly **20 seconds**.

### Scene durations

The generated podcast content is divided into four scenes with these target durations:

- Scene 1: **90 seconds**
- Scene 2: **90 seconds**
- Scene 3: **90 seconds**
- Scene 4: **30 seconds**

### Total scene duration

Total podcast discussion time across all scenes is **300 seconds**.

### Overall fixed ad time

There are six ads total at 20 seconds each, for **120 seconds** of ad inventory.

### Approximate total experience length

Excluding the variable-length welcome message, the experience is approximately **420 seconds** total, or **7 minutes**, plus the welcome message duration.

## 6. Initial Generation Requirements

During **Ad 1**, the backend must generate the following:

- a short contextual description of the requested topic
- three panelist names
- short two- to three-second background/biographical descriptions for each panelist
- a welcome message explaining that the panel is being assembled and that the listener will hear the discussion after these short ads

## 7. Welcome Message Requirements

The welcome message is the second audio item in the playback sequence.

It should:

- acknowledge the listener’s requested topic
- briefly frame what the discussion will cover
- introduce the idea that the panelists are being gathered
- set expectation that the show will begin after the short ads

This segment can be dynamically generated from the topic context and panel setup data.

## 8. Content Generation Model

### Full discussion generation

The backend should generate the full discussion content for the episode.

### Scene segmentation

The full discussion should then be divided into **four scenes**, not played as one continuous block.

Target proportions are:

- Scene 1 = 90 seconds
- Scene 2 = 90 seconds
- Scene 3 = 90 seconds
- Scene 4 = 30 seconds

### Important clarification

The system may generate a full transcript first, but it must not treat the output as a single uninterrupted playback asset. It must be segmented into scene-level units for rendering and assembly.

## 9. Scene Boundary Requirements

Scene boundaries must be content-aware, not arbitrary cuts.

### Scene 1, Scene 2, and Scene 3 endings

Each of the first three scenes must conclude with a moderator-led transition that naturally leads into an ad break.

Examples of the intent:

- brief wrap-up of the current thought
- teaser of what comes next
- spoken break marker such as “we’ll be right back after this short break”

The exact wording can vary, but the function must be consistent.

### Scene 4 ending

Scene 4 is the final 30-second closing segment and should include:

- final thoughts
- closing comments
- thank-you for listening
- any branded or standard sign-off language

Scene 4 should not end with an ad-break transition.

## 10. Backend Orchestration Expectations

The backend should use ad windows as compute buffers for preparing upcoming content.

### During Ad 1

Prepare:

- topic analysis
- short contextual description
- panelist identities
- panelist short bios
- welcome message

### During Ad 2 and Ad 3

Prepare:

- Scene 1 transcript segment
- TTS for Scene 1
- final scene audio assembly for Scene 1

### During Ad 4

Prepare:

- Scene 2 transcript segment
- TTS for Scene 2
- final scene audio assembly for Scene 2

### During Ad 5

Prepare:

- Scene 3 transcript segment
- TTS for Scene 3
- final scene audio assembly for Scene 3

### During Ad 6

Prepare:

- Scene 4 transcript segment
- TTS for Scene 4
- final scene audio assembly for Scene 4

## 11. Audio Asset Types

The system will manage at least these audio asset classes:

### Static ad assets

Pre-created ad MP3 files, each 20 seconds.

### Welcome/interstitial asset

Generated audio message for the episode introduction and expectation setting.

### Scene audio assets

Generated podcast scene MP3 files created from segmented transcript content and speaker voice synthesis.

## 12. Speaker Structure

The episode format assumes a three-person panel-style discussion.

Required generated speaker metadata:

- panelist/moderator names
- short descriptive background for each speaker
- assigned voices for each speaker in TTS

The moderator must be capable of carrying structural duties, including:

- opening and framing the conversation
- moving the conversation between subtopics
- ending Scenes 1 through 3 with a natural ad-break transition
- leading Scene 4 into a conclusion

## 13. Functional Requirements

### FR-1

The system must begin playback with a 20-second pre-created ad immediately after the user requests generation.

### FR-2

The system must generate topic context, panelist identities, short panelist backgrounds, and a welcome message during the first ad window.

### FR-3

The system must play the welcome message immediately after Ad 1.

### FR-4

The system must play two additional 20-second ads after the welcome message and before Scene 1.

### FR-5

The generated podcast discussion must be divided into four scenes with target lengths of 90, 90, 90, and 30 seconds.

### FR-6

Scenes 1 through 3 must end with a moderator-led transition into an ad break.

### FR-7

Scene 4 must serve as the final closing segment and must not transition to another ad.

### FR-8

The backend must use ad windows to prepare the next playable scene before playback reaches that scene.

### FR-9

Each scene must be rendered as a separate audio asset so playback can proceed incrementally.

## 14. Non-Functional Requirements

### NFR-1 Perceived responsiveness

The listener must hear audio quickly after pressing Generate.

### NFR-2 Continuity

Scene-to-scene transitions should feel intentional, with no abrupt conversational cuts.

### NFR-3 Timing discipline

Generated content should be constrained tightly enough that scenes can land near their target durations.

### NFR-4 Incremental readiness

The system should not require the full episode audio to be complete before playback begins.

### NFR-5 Structured closure

The episode must have a clear ending, with Scene 4 reserved for closing thoughts and sign-off.

## 15. Open Implementation Questions

These items are not yet fully specified but should be resolved in the next design pass:

- whether the full transcript is generated up front and then segmented, or whether scenes are generated independently from a shared outline
- how tightly scene duration is enforced at the script level versus corrected at the TTS/rendering level
- whether ads are selected statically, dynamically, or through an ad-serving subsystem
- whether scene preparation runs serially or as concurrent background jobs with dependency checkpoints
- whether playback uses progressive streaming, playlist assembly, or pre-signed asset URLs
- how retries are handled if a scene is not ready before its playback deadline

## 16. Recommended Next Specification Pass

The next document should define:

- backend services involved in orchestration
- queue/job structure for scene preparation
- state model for episode generation progress
- audio asset manifest format
- scene generation prompt/template structure
- moderator transition rules
- duration budgeting strategy for transcript-to-audio conversion
- fallback strategy if generation overruns an ad window
