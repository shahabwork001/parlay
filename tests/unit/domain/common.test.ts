import { describe, expect, it } from "vitest";
import { AggregateRoot } from "../../../src/domain/common/aggregate-root.js";
import { AppErrors } from "../../../src/domain/common/app-error.js";
import type { DomainEvent } from "../../../src/domain/common/domain-event.js";
import { type EntityId, newEntityId } from "../../../src/domain/common/entity.js";
import { fail, ok, okVoid } from "../../../src/domain/common/result.js";

class Widget extends AggregateRoot {
  constructor(id: EntityId = newEntityId()) {
    super(id);
  }

  touch(): void {
    const event: DomainEvent = { type: "widget.touched", occurredAt: new Date(0) };
    this.raise(event);
  }
}

class Gadget extends AggregateRoot {
  constructor(
    id: EntityId,
    readonly label = "gadget",
  ) {
    super(id);
  }
}

describe("Result", () => {
  it("carries a value on success", () => {
    const result = ok(42);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("carries an error on failure", () => {
    const error = AppErrors.notFound("thing.not_found", "Thing was not found.");
    expect(fail(error)).toEqual({ ok: false, error });
  });

  it("supports void success", () => {
    expect(okVoid()).toEqual({ ok: true, value: undefined });
  });
});

describe("AppErrors", () => {
  it.each([
    ["failure", AppErrors.failure],
    ["validation", AppErrors.validation],
    ["not_found", AppErrors.notFound],
    ["conflict", AppErrors.conflict],
    ["unauthorized", AppErrors.unauthorized],
    ["forbidden", AppErrors.forbidden],
    ["rate_limited", AppErrors.rateLimited],
  ] as const)("creates %s errors", (type, factory) => {
    expect(factory("code", "message")).toEqual({ code: "code", message: "message", type });
  });
});

describe("Entity and AggregateRoot", () => {
  it("generates unique UUID v7 ids", () => {
    const first = newEntityId();
    const second = newEntityId();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("treats same type and id as equal", () => {
    const id = newEntityId();
    expect(new Widget(id).equals(new Widget(id))).toBe(true);
    expect(new Widget(id).equals(new Widget())).toBe(false);
  });

  it("never equates different types with the same id", () => {
    const id = newEntityId();
    expect(new Widget(id).equals(new Gadget(id))).toBe(false);
  });

  it("starts unpersisted and collects domain events", () => {
    const widget = new Widget();
    expect(widget.version).toBe(0);

    widget.touch();
    expect(widget.domainEvents).toHaveLength(1);

    widget.clearDomainEvents();
    expect(widget.domainEvents).toHaveLength(0);
  });
});
