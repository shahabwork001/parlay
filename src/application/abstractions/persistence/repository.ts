import type { AggregateRoot } from "../../../domain/common/aggregate-root.js";
import type { EntityId } from "../../../domain/common/entity.js";

/** Persistence port for one aggregate type. Implementations live in infrastructure. */
export interface Repository<TAggregate extends AggregateRoot> {
  getById(id: EntityId): Promise<TAggregate | null>;

  add(aggregate: TAggregate): Promise<void>;

  /**
   * Persists changes with optimistic concurrency on `version`.
   * @returns `false` when the aggregate was modified concurrently or no longer exists.
   */
  update(aggregate: TAggregate): Promise<boolean>;

  delete(id: EntityId): Promise<boolean>;
}
