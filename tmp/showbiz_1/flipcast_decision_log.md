# Flipcast Voice and Casting System — Decision Log

## Table of Contents
1. Flow and user controls
2. Moderation and compatibility
3. Format rules
4. Character system
5. Logging and documentation
6. Lean model
7. Roster and voice assignments

## 1. Flow and user controls
- Explicit voice selection is removed from the default creation flow.
- Users select one of four vibes: Smart, Fun, Warm, Serious.
- Users select one lean: Feminine, Mixed, Masculine.
- There is no explicit recast/regenerate control in V1.
- Names and bios may be shown up front and persist during playback.

## 2. Moderation and compatibility
- Flipcast uses a disallowed-topic model rather than an allowed-topic model.
- All listed disallowed topic classes are included in V1.
- Disallowed topics are rejected outright.
- Rejections do not disclose the exact reason and instead point users to the Terms.
- Allowed but risky topic↔vibe combinations are adjusted rather than rejected.
- The user sees: “We’re adjusting your Flipcast slightly to better fit the topic and vibe.”
- Unusual pairings are allowed unless they become risky.

## 3. Format rules
- Format is system-selected.
- Format selection is based on topic type, topic complexity, topic sensitivity, resolved vibe, and discussion value.
- Panel format uses 1 host + 2 panelists.
- Pals format uses 2 equal voices and no formal moderator.
- Serious should generally route to Solo or Panel, not Pals.
- Solo style is system-determined between host-style monologue and narrated explainer.

## 4. Character system
- Flipcast uses a finite recurring roster of named characters.
- Characters have fixed archetypes across topics and formats.
- Personality does not change to fit format.
- Moderators and panelists are separate archetype families and do not switch.
- Some characters are solo-capable as long as they remain true to archetype.
- Each character has a fixed short bio.
- Each character has one fixed voice.
- The V1 roster includes 18 recurring characters.
- All 18 are part of the main recurring cast identity; none are reserve-only filler.

## 5. Logging and documentation
- Structured inference outputs must be logged in admin output logs and transcript documentation.
- The exact internal reason for any vibe adjustment must also be logged internally.
- Casting should be deterministic once inference output is established.
- Variation may come from inference, not hidden randomness or reuse bias.

## 6. Lean model
- Lean options are Feminine, Mixed, Masculine.
- Solo: Feminine = F, Mixed = F or M, Masculine = M.
- Pals: Feminine = FF, Mixed = FM, Masculine = MM.
- Panel: Feminine = FFF, Mixed = mixed-gender panel, Masculine = MMM.
- Mixed-gender panels may be 2F+1M or 2M+1F.
- The minority-gender panelist may occupy either panelist slot.
- Lean is always user-selected and never system-determined.

## 7. Roster and voice assignments
See `flipcast_character_roster_and_matrix.md` and `flipcast_casting_spec.md` for the full roster and all assigned voice IDs.
