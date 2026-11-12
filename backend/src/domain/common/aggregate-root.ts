import type { DomainEvent } from "./domain-event.js";
import { Entity, type EntityId } from "./entity.js";

export abstract class AggregateRoot extends Entity {
  readonly #domainEvents: DomainEvent[] = [];

  /**
   * Optimistic-concurrency token. 0 means "not persisted yet". Managed by repositories only:
   * set to 1 on insert and incremented on every successful update.
   */
  version: number;

  protected constructor(id: EntityId, version = 0) {
    super(id);
    this.version = version;
  }

  get domainEvents(): readonly DomainEvent[] {
    return this.#domainEvents;
  }

  protected raise(event: DomainEvent): void {
    this.#domainEvents.push(event);
  }

  clearDomainEvents(): void {
    this.#domainEvents.length = 0;
  }
}
