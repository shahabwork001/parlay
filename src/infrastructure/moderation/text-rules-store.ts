import type { Collection, Db } from "mongodb";
import type { TextRulesProvider } from "../../application/features/moderation/ports.js";
import { DEFAULT_TEXT_RULES, type TextRules } from "../../domain/moderation/text-rules.js";

const COLLECTION = "moderation_rules";
const TEXT_RULES_ID = "text";

type TextRulesDocument = TextRules & { _id: string; updatedAt: Date };

/**
 * Text rules from MongoDB (seeded with the defaults on first read), cached in process for a short
 * time so every message does not hit the database. Edits take effect within `refreshMs`.
 */
export class MongoTextRulesProvider implements TextRulesProvider {
  readonly #rules: Collection<TextRulesDocument>;
  #cached: { rules: TextRules; loadedAt: number } | null = null;

  constructor(
    database: Db,
    private readonly refreshMs = 30_000,
    private readonly now: () => number = Date.now,
  ) {
    this.#rules = database.collection<TextRulesDocument>(COLLECTION);
  }

  async current(): Promise<TextRules> {
    if (this.#cached && this.now() - this.#cached.loadedAt < this.refreshMs) return this.#cached.rules;

    const document = await this.#rules.findOneAndUpdate(
      { _id: TEXT_RULES_ID },
      { $setOnInsert: { ...DEFAULT_TEXT_RULES, updatedAt: new Date() } },
      { upsert: true, returnDocument: "after" },
    );
    const {
      _id,
      updatedAt: _updatedAt,
      ...rules
    } = document ?? { ...DEFAULT_TEXT_RULES, _id: "", updatedAt: null };
    this.#cached = { rules, loadedAt: this.now() };
    return rules;
  }
}
