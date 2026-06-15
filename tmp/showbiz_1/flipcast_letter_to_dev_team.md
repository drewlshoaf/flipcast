# Letter to the Flipcast Dev Team

Team,

We are making an important product-quality shift in Flipcast. Until now, the voice and cast experience has been too loose. We have been assembling voices in ways that do not feel coherent enough, and the names, transcript behavior, and actual vocal identity have not always felt like they belong to the same recurring people. That creates a synthetic and unstable experience.

We are fixing that.

The new system is not a voice picker. It is a character-and-casting system.

Users will no longer select explicit named voices in the primary flow. Instead, they will express intent through three user-facing inputs:
- topic
- vibe
- lean

The four vibes remain:
- Smart
- Fun
- Warm
- Serious

The lean options are:
- Feminine
- Mixed
- Masculine

From there, the system must do the real work. It must evaluate moderation, determine whether the requested vibe is appropriate for the topic, resolve the final vibe if an adjustment is needed, choose the format, and then cast the right recurring character or recurring character group.

This is a significant architectural change. The product is now centered on a finite recurring roster of named characters with stable identities.

Every character has:
- a fixed name
- a fixed short bio
- a fixed archetype
- a fixed conversational lens
- a fixed voice
- fixed role eligibility
- a primary vibe fit and adjacent vibe stretch

The important principle is this: characters do not change who they are in order to fit a format. If a format needs a different kind of personality, that should be solved by casting a different character, not by mutating the existing one.

We have also separated moderator and panelist families. Moderators are single-use panel hosts. Pals are equal voices. Some characters can appear in solo and other formats, but only when they remain true to themselves.

This should give us several things we do not have today:
- more recognizable recurring personalities
- stronger chemistry
- better alignment between transcript behavior and the actual cast
- less weirdness in the overall vibe of the output
- better internal traceability for debugging and iteration

A few implementation principles matter here.

First, moderation and vibe resolution must happen before casting. If a topic is disallowed, reject it outright and do not disclose the exact reason. Point the user to the Terms. If a topic is allowed but the requested vibe is risky or inappropriate, do not reject it. Adjust the vibe and show the user this short message:

> We’re adjusting your Flipcast slightly to better fit the topic and vibe.

Second, format is system-selected. Users do not pick Solo, Pals, or Panel directly. The system determines format based on topic type, complexity, sensitivity, resolved vibe, and discussion value.

Third, this should be implemented as hybrid inference plus deterministic rules. Inference should output a structured interpretation. Once that interpretation exists, the downstream casting behavior should be deterministic. We do not want hidden randomness or a reuse-bias layer deciding who shows up.

Fourth, the inference record must be persisted in admin logs and in transcript documentation for each Flipcast. We need a complete explanation trail from input to cast.

Finally, names and bios should be shown up front and persist during the Flipcast experience. These are not hidden internal objects. They are part of the product.

We now have a defined 18-character V1 roster with assigned voice IDs. The next step is to implement the selection, logging, and rendering system around that roster.

Please treat the attached specification as the source of truth for V1 behavior.

— Drew / Product Direction
