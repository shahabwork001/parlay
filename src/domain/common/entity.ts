import { v7 as uuidv7 } from "uuid";

/** Time-ordered UUID v7, generated in the domain before persistence. */
export type EntityId = string;

export const newEntityId = (): EntityId => uuidv7();

export abstract class Entity {
  protected constructor(readonly id: EntityId) {}

  equals(other: Entity): boolean {
    return other.constructor === this.constructor && other.id === this.id;
  }
}
