/**
 * Text moderation rules. Stored as one document so moderators edit them as a unit (Phase 6 adds the
 * editor); these defaults seed it on first use.
 */
export interface TextRules {
  /** Masked with bullets; the message is still delivered. */
  readonly maskedWords: readonly string[];
  /** Slurs and threats: the whole message is rejected and counts against the sender's trust. */
  readonly blockedWords: readonly string[];
  readonly removeLinks: boolean;
  readonly removePhoneNumbers: boolean;
  /** `@handle`, and "snap/insta/discord/telegram ..." followed by a name. */
  readonly removeSocialHandles: boolean;
  /** The same message this many times within the spam window is rejected as spam. */
  readonly maxRepeats: number;
  readonly repeatWindowSeconds: number;
}

export const DEFAULT_TEXT_RULES: TextRules = {
  maskedWords: [
    "fuck",
    "fucking",
    "fucker",
    "motherfucker",
    "shit",
    "bullshit",
    "cunt",
    "bitch",
    "asshole",
    "dick",
    "dickhead",
    "cock",
    "pussy",
    "slut",
    "whore",
    "bastard",
  ],
  blockedWords: ["retard", "faggot", "fag", "nigger", "nigga", "kike", "spic", "chink", "tranny"],
  removeLinks: true,
  removePhoneNumbers: true,
  removeSocialHandles: true,
  maxRepeats: 3,
  repeatWindowSeconds: 30,
};
