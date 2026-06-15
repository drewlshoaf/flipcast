# Flipcast Voice, Cast, and Tone System — Executive Summary

## Table of Contents
1. Product shift
2. Core user-facing model
3. Casting and tone resolution
4. Character system
5. Lean and composition rules
6. Moderation and compatibility rules
7. Logging and transcript documentation
8. Roster and voice assignments
9. Implementation priorities

## 1. Product shift
Flipcast is moving away from explicit voice picking and toward a structured character-and-casting system. Users express intent through topic, vibe, and lean. The system resolves tone, selects the best format, and then chooses the correct recurring character or character group.

This is a major quality improvement. It replaces loosely assembled voices with a finite recurring cast whose identities are stable across topics and formats.

## 2. Core user-facing model
The default creation flow is now:
- user enters a topic
- user selects one of four vibes: Smart, Fun, Warm, Serious
- user selects one lean: Feminine, Mixed, or Masculine
- system evaluates moderation, topic↔vibe compatibility, format, and cast
- system assembles the cast and generates the Flipcast

Users do not explicitly pick named voices in the primary flow.

## 3. Casting and tone resolution
The system uses a hybrid inference plus deterministic rules model:
- inference interprets the topic and returns structured signals
- deterministic rules handle rejection, vibe adjustment, format selection, and cast selection

Variation should come from interpretation, not hidden randomness or reuse bias.

Format is system-selected based on:
- topic type
- topic complexity
- topic sensitivity
- resolved vibe
- discussion value

## 4. Character system
Flipcast now uses a finite recurring roster of 18 named characters.

Each character has:
- a fixed name
- a fixed short bio
- a fixed archetype
- a fixed conversational lens
- a fixed voice
- fixed role eligibility
- primary and adjacent vibe fit

Characters should remain recognizably themselves across topics and formats. The format may change their structural role, but it does not change their identity.

## 5. Lean and composition rules
Lean is always user-selected and never system-determined.

Lean options:
- Feminine
- Mixed
- Masculine

Mapping:
- Solo: Feminine = F, Mixed = F or M, Masculine = M
- Pals: Feminine = FF, Mixed = FM, Masculine = MM
- Panel: Feminine = FFF, Mixed = mixed-gender panel, Masculine = MMM

Mixed-gender panels may be 2F+1M or 2M+1F depending on the selected grouping. The minority-gender character may occupy either panelist slot.

## 6. Moderation and compatibility rules
Flipcast uses a disallowed-topic model rather than an allowed-topic model. Disallowed topics are rejected outright. The system does not explain the exact reason to the user and instead points them to the Terms.

Allowed but risky topic↔vibe mismatches are adjusted rather than rejected. The user sees this message:

> We’re adjusting your Flipcast slightly to better fit the topic and vibe.

Unusual pairings are allowed unless they become risky.

## 7. Logging and transcript documentation
The system must log structured inference output in:
- admin output logs
- transcript documentation for each Flipcast

This includes:
- user input
- selected vibe
- lean
- disallowed result
- resolved vibe
- adjustment status
- adjustment reason
- topic complexity
- topic sensitivity
- discussion value
- selected format
- selected cast group
- selected characters

## 8. Roster and voice assignments
The V1 system is designed around 18 recurring characters. All 18 are part of the main cast identity; none are reserve-only filler.

All 18 character voice IDs are now assigned.

## 9. Implementation priorities
1. Replace direct voice selection in the creation flow.
2. Implement structured inference output.
3. Implement moderation, vibe resolution, and format selection.
4. Implement deterministic cast selection against the 18-character roster.
5. Persist logging and transcript documentation fields.
6. Surface recurring names and bios in the player UI.

This system should materially improve coherence, chemistry, recognizability, and trust in the Flipcast experience.
