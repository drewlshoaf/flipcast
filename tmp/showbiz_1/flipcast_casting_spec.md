# Flipcast Voice, Character, and Casting System Specification

## Table of Contents
1. Purpose
2. Goals
3. User-facing flow
4. Input model
5. Moderation model
6. Topic↔vibe compatibility model
7. Inference output schema
8. Format selection rules
9. Lean and composition rules
10. Character system
11. Role families and eligibility
12. Cast selection rules
13. Transcript generation requirements
14. Player and UI requirements
15. Admin logging and transcript documentation
16. Character roster with assigned voice IDs
17. Implementation notes
18. Open follow-on enhancements

## 1. Purpose
This specification defines the V1 Flipcast voice, cast, and tone system. It replaces direct voice selection with a recurring-character casting system driven by topic, vibe, lean, moderation, compatibility logic, and deterministic cast selection.

## 2. Goals
The system should:
- improve coherence between voice, character, and transcript behavior
- create a recognizable recurring cast
- preserve user intent while guarding against risky tone mismatches
- make cast selection internally explainable and deterministic
- keep the user-facing flow simple

## 3. User-facing flow
The primary creation flow is:
1. user enters topic
2. user selects vibe
3. user selects lean
4. system evaluates moderation and compatibility
5. system resolves vibe if needed
6. system selects format
7. system assembles cast
8. system generates transcript and audio

User-facing wording may include:
- “Assembling your cast”

The system may show this message if a vibe adjustment occurs:
- “We’re adjusting your Flipcast slightly to better fit the topic and vibe.”

## 4. Input model
### 4.1 Topic
Freeform user input.

### 4.2 Vibe
Allowed values:
- Smart
- Fun
- Warm
- Serious

### 4.3 Lean
Allowed values:
- Feminine
- Mixed
- Masculine

Users do not select explicit named voices in the primary flow.

## 5. Moderation model
Flipcast uses a disallowed-topic model.

### 5.1 Disallowed topic classes
- Sexual content involving minors
- Child abuse or exploitation
- Graphic sexual violence
- Graphic violence or gore
- Suicide or self-harm instruction or encouragement
- Eating-disorder encouragement or self-destruction guidance
- Illegal drug manufacturing or hard-drug facilitation
- Violent wrongdoing instruction
- Weapon construction or attack guidance
- Crime facilitation
- Terrorism or extremist praise / support
- Hate or dehumanizing content
- Non-consensual sexual content
- Personal criminal plans or evasion
- Medical, legal, or financial harm optimization
- Instructions for abuse, coercion, or manipulation

### 5.2 Rejection behavior
If disallowed:
- reject outright
- do not explain the specific reason
- point the user to the Terms
- do not rewrite or suggest an alternative automatically

## 6. Topic↔vibe compatibility model
The system should classify topic↔vibe pairings into:
- Natural
- Unusual but acceptable
- Risky mismatch

### 6.1 Natural
Use selected vibe unchanged.

### 6.2 Unusual but acceptable
Allow selected vibe unchanged.

### 6.3 Risky mismatch
Adjust vibe and proceed.

Unusual pairings are allowed unless they become risky.

## 7. Inference output schema
The inference layer should output structured labels before deterministic selection occurs.

Recommended fields:
- user_input
- selected_vibe
- lean
- disallowed
- disallowed_reason_code
- resolved_vibe
- adjustment_applied
- adjustment_reason_code
- adjustment_reason_text
- topic_type
- topic_complexity
- topic_sensitivity
- discussion_value
- selected_format
- solo_style
- selected_group_id
- selected_character_ids
- transcript_mode

Variation may come from inference. Downstream cast selection should be deterministic given inference output.

## 8. Format selection rules
Allowed formats:
- Solo
- Pals
- Panel

Format is system-selected based on:
- topic type
- topic complexity
- topic sensitivity
- resolved vibe
- discussion value

### 8.1 General rules
- Solo: clarity, authority, intimacy, reflection, sensitivity
- Pals: chemistry, casual flow, warmth, fun, smart equal conversation
- Panel: nuance, contrast, multi-perspective discussion

### 8.2 Serious routing rule
Serious should generally route to Solo or Panel, not Pals.

### 8.3 Solo style
Within Solo, the system decides whether the piece feels more like:
- a host-style monologue
- a narrated explainer

This is system-determined based on full input context.

## 9. Lean and composition rules
### 9.1 Solo
- Feminine = F
- Mixed = F or M
- Masculine = M

### 9.2 Pals
- Feminine = FF
- Mixed = FM
- Masculine = MM

### 9.3 Panel
- Feminine = FFF
- Mixed = mixed-gender panel
- Masculine = MMM

For mixed panels:
- composition may be 2F+1M or 2M+1F
- minority-gender character may occupy either panelist slot

## 10. Character system
Flipcast uses a finite recurring roster of named characters.

Each character has:
- fixed name
- fixed short bio
- fixed archetype
- fixed conversational lens
- fixed voice
- fixed role eligibility
- primary vibe fit
- adjacent vibe fit
- non-fit zones

Characters do not change who they are to fit format.

## 11. Role families and eligibility
### 11.1 Moderators
- panel host only
- separate archetype family from panelists
- do not switch into panelist or pal roles

### 11.2 Panelists
- perspective-bearing characters
- may be solo-capable if they stay true to archetype

### 11.3 Pals
- equal-voice conversational characters
- not moderated internally
- should support Fun/Warm and meaningful Smart chemistry

### 11.4 Solo-capable characters
Some characters can carry solo while remaining true to themselves.

## 12. Cast selection rules
### 12.1 General
Cast selection must use:
- resolved vibe
- selected format
- selected lean
- role eligibility
- character vibe fit
- deterministic grouping rules

### 12.2 Panel structure
- 1 host
- 2 panelists

### 12.3 Pals structure
- 2 equal voices

### 12.4 Host rule
For majority-side mixed panels, host should align with the group logic selected by deterministic grouping. For V1, mixed panels may use pre-approved groupings rather than role-swapping logic at runtime.

## 13. Transcript generation requirements
The transcript prompt must know:
- resolved vibe
- selected format
- each character name
- each character bio
- each character role in the episode
- chemistry expectations
- pacing expectations

Transcript behavior must align with the assigned cast. Characters must sound like themselves.

## 14. Player and UI requirements
The UI may show:
- cast names up front
- cast bios up front
- cast names and bios persisting during the Flipcast

The player should present the cast as intentional recurring identities, not disposable generated placeholders.

## 15. Admin logging and transcript documentation
Persist structured inference output in:
- admin output logs
- transcript documentation for each Flipcast

This includes exact internal adjustment reasons, even when not shown to the user.

## 16. Character roster with assigned voice IDs

### Moderators
| Name | Voice ID | Bio |
|---|---|---|
| Elena Vale | `a3b48c1e46324196a72830219d19a05e` | A composed, incisive host who keeps complex conversations clear, balanced, and moving. |
| Nadia Cross | `73bbf7a4e6e74deca7be119650e59661` | A steady, weight-bearing host who brings seriousness, structure, and calm authority to difficult conversations. |
| Mara Quinn | `e3cd384158934cc9a01029cd7d278634` | A lucid, thoughtful host who makes nuanced discussions feel accessible without flattening them. |
| Julian Hart | `bf322df2096a46f18c579d0baa36f41d` | A sharp but approachable host who frames ideas clearly and keeps discussions intellectually honest. |
| Marcus Reed | `79d0bd3e4e5444b18f7b6d89b5927bf1` | A disciplined host with a sober presence and a talent for keeping serious discussions grounded and coherent. |

### Panelists / Solo-capable
| Name | Voice ID | Bio |
|---|---|---|
| Tess Rowan | `933563129e564b19a115bedd57b7406a` | A grounded, thoughtful voice who keeps ideas human, practical, and emotionally honest. |
| Simone Avery | `397c0a23f53042fbb6a557ede9968063` | A sober analytical voice who brings restraint, judgment, and seriousness to hard topics. |
| Ivy Monroe | `0f68f38f208b4cf6987454346f848a0a` | A sharp, lively observer of culture who adds wit, pattern recognition, and social texture. |
| Sera Whitlock | `9a9cf47702da476aa4629e2506d4a857` | A precise, composed voice who excels at making complicated things feel organized, calm, and intelligible. |
| Adrian Cole | `06965e7d8e614f31babd11f742544b8a` | A systems-minded analyst who likes pulling ideas apart and following consequences to their logical end. |
| Damon Pierce | `52a238a0e70c4e589bd41561d26e7a08` | A sharp realist who challenges easy narratives and keeps discussions honest about tradeoffs and risk. |
| Owen Mercer | `d8a1340984ee4b63ad1ffae27a6a4339` | A reflective, approachable commentator who connects complex ideas to everyday life without oversimplifying them. |
| Graham Ellis | `cc327654131a46d7b41e1da51dbfbaab` | A restrained, highly structured voice built for briefings, serious explainers, and tightly reasoned summaries. |

### Pals / Solo-capable
| Name | Voice ID | Bio |
|---|---|---|
| Lena Brooks | `0b846ae657904027a12d2d867d1a143b` | A warm, friendly voice who makes listeners feel understood without losing forward motion. |
| Chloe Bennett | `59e9dc1cb20c452584788a2690c80970` | A lively, personable voice who makes interesting topics feel fun, approachable, and easy to lean into. |
| Caleb Rowan | `52e0660e03fe4f9a8d2336f67cab5440` | A smart, easygoing voice who can teach without sounding formal and converse without sounding loose. |
| Ethan Vale | `536d3a5e000945adb7038665781a4aca` | A lively, confident voice who brings energy, rhythm, and momentum without losing coherence. |
| Noah Bishop | `0b74ead073f2474a904f69033535b98e` | A calm, thoughtful conversationalist who brings comfort, perspective, and an easy sense of trust. |

## 17. Implementation notes
- prefer pre-approved cast groupings over fully dynamic combinatorics in V1
- keep character identity stable across transcript, UI, and audio
- avoid using a character outside its role eligibility without explicit design approval
- keep logs complete enough to explain every cast decision after the fact

## 18. Open follow-on enhancements
- mixed-gender specialized pals groupings beyond FM default
- favorites or saved preferred casts
- richer cast avatars and visual identity
- post-generation recast / alternate interpretation mode
