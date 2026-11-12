import type { Db } from "mongodb";
import type { UserRepository } from "../../../application/features/identity/ports.js";
import type { Role } from "../../../domain/identity/roles.js";
import type { TermsAcceptance } from "../../../domain/identity/terms-acceptance.js";
import { type TwoFactorState, User } from "../../../domain/identity/user.js";
import type { MongoIndexDefinition } from "./mongo-indexes.js";
import { translateDuplicateKey } from "./mongo-errors.js";
import { type AggregateDocument, MongoRepository } from "./mongo-repository.js";

const COLLECTION = "users";

interface UserDocument extends AggregateDocument {
  email: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  roles: Role[];
  termsAcceptance: TermsAcceptance | null;
  twoFactor: TwoFactorState | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  createdAt: Date;
}

export const USER_INDEXES: MongoIndexDefinition = {
  collection: COLLECTION,
  indexes: [
    { key: { email: 1 }, name: "email_unique", unique: true },
    { key: { roles: 1 }, name: "roles", partialFilterExpression: { "roles.0": { $exists: true } } },
  ],
};

export class MongoUserRepository extends MongoRepository<User, UserDocument> implements UserRepository {
  constructor(database: Db) {
    super(database, COLLECTION);
  }

  async findByEmail(email: string): Promise<User | null> {
    const document = await this.collection.findOne({ email });
    return document ? this.toAggregate(document) : null;
  }

  countWithRole(role: Role): Promise<number> {
    return this.collection.countDocuments({ roles: role });
  }

  override add(user: User): Promise<void> {
    return translateDuplicateKey("users.email", () => super.add(user));
  }

  protected toDocument(user: User): UserDocument {
    return {
      _id: user.id,
      version: user.version,
      email: user.email,
      passwordHash: user.passwordHash,
      emailVerifiedAt: user.emailVerifiedAt,
      roles: [...user.roles],
      termsAcceptance: user.termsAcceptance,
      twoFactor: user.twoFactor,
      failedLoginCount: user.failedLoginCount,
      lockedUntil: user.lockedUntil,
      createdAt: user.createdAt,
    };
  }

  protected toAggregate(document: UserDocument): User {
    return User.restore({ ...document, id: document._id });
  }
}
