import type { Collection, Db, Filter, OptionalUnlessRequiredId } from "mongodb";
import type { Repository } from "../../../application/abstractions/persistence/repository.js";
import type { AggregateRoot } from "../../../domain/common/aggregate-root.js";
import type { EntityId } from "../../../domain/common/entity.js";

/** Every persisted aggregate document stores its id as `_id` and a concurrency `version`. */
export interface AggregateDocument {
  _id: EntityId;
  version: number;
}

/**
 * Generic Mongo repository. Subclasses map between aggregate and document explicitly, so no
 * Mongo types or BSON conventions reach the domain. Updates use optimistic concurrency.
 */
export abstract class MongoRepository<
  TAggregate extends AggregateRoot,
  TDocument extends AggregateDocument,
> implements Repository<TAggregate> {
  protected readonly collection: Collection<TDocument>;

  protected constructor(database: Db, collectionName: string) {
    this.collection = database.collection<TDocument>(collectionName);
  }

  protected abstract toDocument(aggregate: TAggregate): TDocument;

  protected abstract toAggregate(document: TDocument): TAggregate;

  async getById(id: EntityId): Promise<TAggregate | null> {
    const document = await this.collection.findOne(this.byId(id));
    return document ? this.toAggregate(document as TDocument) : null;
  }

  async add(aggregate: TAggregate): Promise<void> {
    aggregate.version = 1;
    await this.collection.insertOne(this.toDocument(aggregate) as OptionalUnlessRequiredId<TDocument>);
  }

  async update(aggregate: TAggregate): Promise<boolean> {
    const expectedVersion = aggregate.version;
    aggregate.version = expectedVersion + 1;

    const filter = { _id: aggregate.id, version: expectedVersion } as Filter<TDocument>;
    const result = await this.collection.replaceOne(filter, this.toDocument(aggregate));
    if (result.matchedCount === 1) return true;

    aggregate.version = expectedVersion;
    return false;
  }

  async delete(id: EntityId): Promise<boolean> {
    const result = await this.collection.deleteOne(this.byId(id));
    return result.deletedCount === 1;
  }

  protected byId(id: EntityId): Filter<TDocument> {
    return { _id: id } as Filter<TDocument>;
  }
}
