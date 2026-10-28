import type { TextRules } from "../../../domain/moderation/text-rules.js";
import { MAX_MESSAGE_LENGTH } from "../chat/schemas.js";

export const LINK_PLACEHOLDER = "[link removed]";
export const CONTACT_PLACEHOLDER = "[contact removed]";

const URL_PATTERN =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|me|app|gg|tv|xyz|info|biz|ru|de|uk|us|link|site|online|club)\b(?:\/\S*)?/gi;

const EMAIL_PATTERN = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;

/** Seven or more digits, optionally separated by spaces, dots, dashes or brackets. */
const PHONE_PATTERN = /\+?\d(?:[\s().-]*\d){6,}/g;

const AT_HANDLE_PATTERN = /(^|[^\p{L}\p{N}_.])@[a-z0-9_.]{3,30}/giu;

/** A platform name followed by something that looks like a username (has a digit, _ or .). */
const PLATFORM_HANDLE_PATTERN =
  /\b(?:snapchat|snap|instagram|insta|discord|telegram|kik|whatsapp|tiktok|onlyfans|skype)\b\s*(?:[:=-]|is|at|me)?\s*@?([a-z0-9_.]{3,30})/gi;

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

/** Lowercase, undo common leetspeak, and collapse runs of three or more letters ("fuuuck"). */
export const normaliseWord = (word: string): string =>
  word
    .toLowerCase()
    .split("")
    .map((character) => LEET[character] ?? character)
    .join("")
    .replace(/(.)\1{2,}/g, "$1");

export type RemovedContent = "link" | "phone" | "handle";

export type TextModeration =
  | {
      readonly status: "ok";
      readonly text: string;
      readonly masked: boolean;
      readonly removed: readonly RemovedContent[];
    }
  | { readonly status: "blocked" }
  | { readonly status: "empty" };

/**
 * Applies the text rules to an outgoing message. Blocked words reject the whole message; masked
 * words become bullets of the same length; links, phone numbers and social handles are replaced.
 * In strict mode (low-trust and shadow pools) masked words also reject the message.
 */
export function moderateText(raw: string, rules: TextRules, options: { strict: boolean }): TextModeration {
  const capped = raw.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!capped) return { status: "empty" };

  const blocked = new Set(rules.blockedWords.map(normaliseWord));
  const maskedWords = new Set(rules.maskedWords.map(normaliseWord));
  const words = capped.match(/[\p{L}\p{N}@$]+/gu) ?? [];
  if (words.some((word) => blocked.has(normaliseWord(word)))) return { status: "blocked" };
  if (options.strict && words.some((word) => maskedWords.has(normaliseWord(word))))
    return { status: "blocked" };

  const removed = new Set<RemovedContent>();
  let text = capped;
  const replace = (
    pattern: RegExp,
    kind: RemovedContent,
    replacer: (match: string, ...groups: string[]) => string,
  ) => {
    text = text.replace(pattern, (match: string, ...groups: string[]) => {
      const replacement = replacer(match, ...groups);
      if (replacement !== match) removed.add(kind);
      return replacement;
    });
  };

  if (rules.removeSocialHandles) replace(EMAIL_PATTERN, "handle", () => CONTACT_PLACEHOLDER);
  if (rules.removeLinks) replace(URL_PATTERN, "link", () => LINK_PLACEHOLDER);
  if (rules.removeSocialHandles) {
    replace(AT_HANDLE_PATTERN, "handle", (_match, prefix = "") => `${prefix}${CONTACT_PLACEHOLDER}`);
    replace(PLATFORM_HANDLE_PATTERN, "handle", (match, handle = "") =>
      /[\d_.]/.test(handle) || /[:=@-]/.test(match) ? CONTACT_PLACEHOLDER : match,
    );
  }
  if (rules.removePhoneNumbers) replace(PHONE_PATTERN, "phone", () => CONTACT_PLACEHOLDER);

  let masked = false;
  text = text.replace(/[\p{L}\p{N}@$]+/gu, (word) => {
    if (!maskedWords.has(normaliseWord(word))) return word;
    masked = true;
    return "•".repeat(word.length);
  });

  return { status: "ok", text, masked, removed: [...removed] };
}

/**
 * Per-connection spam guard: the same message (ignoring case and spacing) too many times within
 * the window is spam. Cheap enough to keep in memory with the socket.
 */
export class RepeatGuard {
  readonly #recent: { key: string; at: number }[] = [];

  /** Records the message and returns true when it is one repeat too many. */
  isSpam(text: string, now: number, rules: Pick<TextRules, "maxRepeats" | "repeatWindowSeconds">): boolean {
    const windowMs = rules.repeatWindowSeconds * 1000;
    while (this.#recent.length > 0 && now - (this.#recent[0]?.at ?? now) > windowMs) this.#recent.shift();
    const key = text.toLowerCase().replace(/\s+/g, " ").trim();
    const repeats = this.#recent.filter((entry) => entry.key === key).length;
    this.#recent.push({ key, at: now });
    if (this.#recent.length > 50) this.#recent.shift();
    return repeats >= rules.maxRepeats;
  }
}
