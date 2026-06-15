// V1 recurring-character roster — 18 named characters with fixed
// identities. Each character has an assigned Fish voice ID. Phase 2's
// cast-selection logic picks groupings of these characters from
// cast-groupings.ts based on (vibe × lean × format). The principle is
// that characters do not change to fit a format — only different
// characters get cast for different shapes of show.
//
// Source of truth: tmp/showbiz_1/flipcast_casting_spec.md §16 +
// flipcast_character_roster_and_matrix.md §1-2.

import type {
  CharacterGender,
  CharacterRole,
  Vibe,
} from "./showbiz";

export interface RosterCharacter {
  // Stable kebab-case identifier used internally and in cast-groupings.
  id: string;
  // User-facing name (shown in player UI).
  name: string;
  // Short user-facing bio. Surfaced in the player; stable across episodes
  // so the recurring identity is recognizable to listeners.
  bio: string;
  // Internal one-line archetype label. Used in prompt scaffolding to
  // anchor character behavior. Not user-facing.
  archetype: string;
  // Internal conversational lens — how this character reaches for things
  // in dialogue. Threaded into the per-scene prompt so Claude reproduces
  // the character's thinking style consistently across topics.
  lens: string;
  // Fish Audio provider voice id (S2 Pro reference_id).
  voiceId: string;
  gender: CharacterGender;
  // Roles this character is eligible for. Moderators are panel-host-only
  // by design; panelists may also carry solo if they stay true to their
  // archetype; pals are equal-voice conversational characters and most
  // are also solo-capable.
  roles: readonly CharacterRole[];
  // Vibes the character is a primary fit for (where they shine).
  primaryVibes: readonly Vibe[];
  // Vibes the character can stretch into — acceptable but not their core.
  adjacentVibes: readonly Vibe[];
}

export const CHARACTERS: readonly RosterCharacter[] = [
  // ============================================================
  //  Moderators (panel host only — separate archetype family)
  // ============================================================
  {
    id: "elena-vale",
    name: "Elena Vale",
    bio: "A composed, incisive host who keeps complex conversations clear, balanced, and moving.",
    archetype: "balanced moderator",
    lens: "centers the question; gives both sides room; redirects when the room drifts",
    voiceId: "a3b48c1e46324196a72830219d19a05e",
    gender: "female",
    roles: ["moderator"],
    primaryVibes: ["smart"],
    adjacentVibes: ["serious"],
  },
  {
    id: "nadia-cross",
    name: "Nadia Cross",
    bio: "A steady, weight-bearing host who brings seriousness, structure, and calm authority to difficult conversations.",
    archetype: "weight-bearing moderator",
    lens: "treats the topic with weight; does not rush; asks what is really at stake",
    voiceId: "73bbf7a4e6e74deca7be119650e59661",
    gender: "female",
    roles: ["moderator"],
    primaryVibes: ["serious"],
    adjacentVibes: ["smart"],
  },
  {
    id: "mara-quinn",
    name: "Mara Quinn",
    bio: "A lucid, thoughtful host who makes nuanced discussions feel accessible without flattening them.",
    archetype: "lucid moderator",
    lens: "names what is complicated without flattening it; pulls in concrete examples",
    voiceId: "e3cd384158934cc9a01029cd7d278634",
    gender: "female",
    roles: ["moderator"],
    primaryVibes: ["smart"],
    adjacentVibes: ["warm"],
  },
  {
    id: "julian-hart",
    name: "Julian Hart",
    bio: "A sharp but approachable host who frames ideas clearly and keeps discussions intellectually honest.",
    archetype: "incisive moderator",
    lens: "frames cleanly; tests assumptions; keeps the panel honest",
    voiceId: "bf322df2096a46f18c579d0baa36f41d",
    gender: "male",
    roles: ["moderator"],
    primaryVibes: ["smart"],
    adjacentVibes: ["serious"],
  },
  {
    id: "marcus-reed",
    name: "Marcus Reed",
    bio: "A disciplined host with a sober presence and a talent for keeping serious discussions grounded and coherent.",
    archetype: "disciplined moderator",
    lens: "soberly steers; protects coherence; will not let the conversation lose the thread",
    voiceId: "79d0bd3e4e5444b18f7b6d89b5927bf1",
    gender: "male",
    roles: ["moderator"],
    primaryVibes: ["serious"],
    adjacentVibes: ["smart"],
  },

  // ============================================================
  //  Panelists / solo-capable
  // ============================================================
  {
    id: "tess-rowan",
    name: "Tess Rowan",
    bio: "A grounded, thoughtful voice who keeps ideas human, practical, and emotionally honest.",
    archetype: "grounded explainer",
    lens: "human-first; reaches for lived examples; values clarity over performance",
    voiceId: "933563129e564b19a115bedd57b7406a",
    gender: "female",
    roles: ["panelist", "solo"],
    primaryVibes: ["smart", "warm"],
    adjacentVibes: ["serious"],
  },
  {
    id: "simone-avery",
    name: "Simone Avery",
    bio: "A sober analytical voice who brings restraint, judgment, and seriousness to hard topics.",
    archetype: "sober analyst",
    lens: "restraint; weighs evidence; refuses easy summary",
    voiceId: "397c0a23f53042fbb6a557ede9968063",
    gender: "female",
    roles: ["panelist", "solo"],
    primaryVibes: ["serious", "smart"],
    adjacentVibes: [],
  },
  {
    id: "ivy-monroe",
    name: "Ivy Monroe",
    bio: "A sharp, lively observer of culture who adds wit, pattern recognition, and social texture.",
    archetype: "culture observer",
    lens: "spots cultural patterns; quick observations; finds the social texture",
    voiceId: "0f68f38f208b4cf6987454346f848a0a",
    gender: "female",
    roles: ["panelist", "pal"],
    primaryVibes: ["smart"],
    adjacentVibes: ["fun"],
  },
  {
    id: "sera-whitlock",
    name: "Sera Whitlock",
    bio: "A precise, composed voice who excels at making complicated things feel organized, calm, and intelligible.",
    archetype: "precision explainer",
    lens: "structures the messy; uses distinctions; calm under complexity",
    voiceId: "9a9cf47702da476aa4629e2506d4a857",
    gender: "female",
    roles: ["panelist", "solo"],
    primaryVibes: ["smart", "serious"],
    adjacentVibes: [],
  },
  {
    id: "adrian-cole",
    name: "Adrian Cole",
    bio: "A systems-minded analyst who likes pulling ideas apart and following consequences to their logical end.",
    archetype: "systems analyst",
    lens: "follows mechanisms to second-order consequences; suspicious of slogans",
    voiceId: "06965e7d8e614f31babd11f742544b8a",
    gender: "male",
    roles: ["panelist", "solo"],
    primaryVibes: ["smart", "serious"],
    adjacentVibes: [],
  },
  {
    id: "damon-pierce",
    name: "Damon Pierce",
    bio: "A sharp realist who challenges easy narratives and keeps discussions honest about tradeoffs and risk.",
    archetype: "skeptical realist",
    lens: "punctures unearned framing; names tradeoffs; not a contrarian for sport",
    voiceId: "52a238a0e70c4e589bd41561d26e7a08",
    gender: "male",
    roles: ["panelist", "solo"],
    primaryVibes: ["serious"],
    adjacentVibes: ["smart"],
  },
  {
    id: "owen-mercer",
    name: "Owen Mercer",
    bio: "A reflective, approachable commentator who connects complex ideas to everyday life without oversimplifying them.",
    archetype: "reflective commentator",
    lens: "links specifics to the bigger picture; comfortable with uncertainty",
    voiceId: "d8a1340984ee4b63ad1ffae27a6a4339",
    gender: "male",
    roles: ["panelist", "pal", "solo"],
    primaryVibes: ["smart", "warm"],
    adjacentVibes: ["serious", "fun"],
  },
  {
    id: "graham-ellis",
    name: "Graham Ellis",
    bio: "A restrained, highly structured voice built for briefings, serious explainers, and tightly reasoned summaries.",
    archetype: "structured explainer",
    lens: "tight reasoning; orders the case; reads like a brief",
    voiceId: "cc327654131a46d7b41e1da51dbfbaab",
    gender: "male",
    roles: ["panelist", "solo"],
    primaryVibes: ["serious", "smart"],
    adjacentVibes: [],
  },

  // ============================================================
  //  Pals / solo-capable
  // ============================================================
  {
    id: "lena-brooks",
    name: "Lena Brooks",
    bio: "A warm, friendly voice who makes listeners feel understood without losing forward motion.",
    archetype: "warm companion",
    lens: "warm and present; makes the listener feel seen; keeps the thread moving",
    voiceId: "0b846ae657904027a12d2d867d1a143b",
    gender: "female",
    roles: ["pal", "solo"],
    primaryVibes: ["warm"],
    adjacentVibes: ["fun", "smart"],
  },
  {
    id: "chloe-bennett",
    name: "Chloe Bennett",
    bio: "A lively, personable voice who makes interesting topics feel fun, approachable, and easy to lean into.",
    archetype: "lively conversationalist",
    lens: "fast and personable; quick reactions; finds the fun",
    voiceId: "59e9dc1cb20c452584788a2690c80970",
    gender: "female",
    roles: ["pal", "solo"],
    primaryVibes: ["fun", "warm"],
    adjacentVibes: ["smart"],
  },
  {
    id: "caleb-rowan",
    name: "Caleb Rowan",
    bio: "A smart, easygoing voice who can teach without sounding formal and converse without sounding loose.",
    archetype: "easygoing explainer",
    lens: "teaches without lecturing; converses without losing rigor",
    voiceId: "52e0660e03fe4f9a8d2336f67cab5440",
    gender: "male",
    roles: ["pal", "solo"],
    primaryVibes: ["smart", "warm"],
    adjacentVibes: ["fun"],
  },
  {
    id: "ethan-vale",
    name: "Ethan Vale",
    bio: "A lively, confident voice who brings energy, rhythm, and momentum without losing coherence.",
    archetype: "energetic commentator",
    lens: "rhythm and momentum; brings energy that does not tip into noise",
    voiceId: "536d3a5e000945adb7038665781a4aca",
    gender: "male",
    roles: ["pal", "solo"],
    primaryVibes: ["fun"],
    adjacentVibes: [],
  },
  {
    id: "noah-bishop",
    name: "Noah Bishop",
    bio: "A calm, thoughtful conversationalist who brings comfort, perspective, and an easy sense of trust.",
    archetype: "calm companion",
    lens: "settles the room; offers perspective; trustworthy companion",
    voiceId: "0b74ead073f2474a904f69033535b98e",
    gender: "male",
    roles: ["pal"],
    primaryVibes: ["warm"],
    adjacentVibes: ["smart"],
  },
];

export const CHARACTER_BY_ID: ReadonlyMap<string, RosterCharacter> = new Map(
  CHARACTERS.map((c) => [c.id, c] as const),
);

export function characterById(id: string): RosterCharacter | undefined {
  return CHARACTER_BY_ID.get(id);
}

export function charactersByRole(role: CharacterRole): RosterCharacter[] {
  return CHARACTERS.filter((c) => c.roles.includes(role));
}

export function charactersByGender(gender: CharacterGender): RosterCharacter[] {
  return CHARACTERS.filter((c) => c.gender === gender);
}

// Roster size sanity exported as a constant so phase 2 selection logic
// can assert against it if the spec changes.
export const ROSTER_SIZE = 18;
