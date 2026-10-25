import { MAX_MESSAGE_LENGTH } from "./schemas.js";

/**
 * Default profanity list, matched as whole words after light normalisation. Phase 5 replaces it with
 * admin-editable word lists stored in MongoDB and cached in Redis.
 */
const DEFAULT_BLOCKED_WORDS = [
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
  "retard",
  "faggot",
  "fag",
  "nigger",
  "nigga",
  "kike",
  "spic",
  "chink",
  "tranny",
];

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
};

const URL_PATTERN =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|me|app|gg|tv|xyz|info|biz|ru|de|uk|us|link|site|online|club)\b(?:\/\S*)?/gi;

export const LINK_PLACEHOLDER = "[link removed]";

export interface FilteredText {
  readonly text: string;
  readonly masked: boolean;
  readonly linksRemoved: boolean;
}

const normalise = (word: string) =>
  word
    .toLowerCase()
    .split("")
    .map((character) => LEET[character] ?? character)
    .join("")
    .replace(/(.)\1{2,}/g, "$1");

/**
 * Cleans an outgoing chat message: trims and caps length, removes links by default, and masks
 * blocked words with bullets (same length, so the message still reads naturally).
 */
export function filterChatText(
  raw: string,
  blockedWords: readonly string[] = DEFAULT_BLOCKED_WORDS,
): FilteredText {
  const blocked = new Set(blockedWords);
  const capped = raw.trim().slice(0, MAX_MESSAGE_LENGTH);

  const withoutLinks = capped.replace(URL_PATTERN, LINK_PLACEHOLDER);
  const linksRemoved = withoutLinks !== capped;

  let masked = false;
  const text = withoutLinks.replace(/[\p{L}\p{N}@$]+/gu, (word) => {
    if (!blocked.has(normalise(word))) return word;
    masked = true;
    return "•".repeat(word.length);
  });

  return { text, masked, linksRemoved };
}
