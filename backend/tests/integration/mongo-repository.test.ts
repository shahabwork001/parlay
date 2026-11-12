import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AggregateRoot } from "../../src/domain/common/aggregate-root.js";
import { type EntityId, newEntityId } from "../../src/domain/common/entity.js";
import { createInfrastructure, type Infrastructure } from "../../src/infrastructure/infrastructure.js";
import {
  type AggregateDocument,
  MongoRepository,
} from "../../src/infrastructure/persistence/mongo/mongo-repository.js";
import { silentLogger, testInfrastructureConfig } from "./support.js";

class Note extends AggregateRoot {
  constructor(
    id: EntityId,
    public text: string,
    version = 0,
  ) {
    super(id, version);
  }
}

interface NoteDocument extends AggregateDocument {
  text: string;
}

class NoteRepository extends MongoRepository<Note, NoteDocument> {
  constructor(infrastructure: Infrastructure) {
    super(infrastructure.database, "notes");
  }

  protected toDocument(note: Note): NoteDocument {
    return { _id: note.id, version: note.version, text: note.text };
  }

  protected toAggregate(document: NoteDocument): Note {
    return new Note(document._id, document.text, document.version);
  }
}

describe("MongoRepository", () => {
  let infrastructure: Infrastructure;
  let repository: NoteRepository;

  beforeAll(async () => {
    infrastructure = await createInfrastructure(testInfrastructureConfig(), silentLogger, "mongo-tests");
    repository = new NoteRepository(infrastructure);
  });

  afterAll(async () => {
    await infrastructure.database.dropDatabase();
    await infrastructure.close();
  });

  it("reads back an added aggregate at version 1", async () => {
    const note = new Note(newEntityId(), "hello");

    await repository.add(note);
    const loaded = await repository.getById(note.id);

    expect(loaded).toEqual(expect.objectContaining({ id: note.id, text: "hello", version: 1 }));
  });

  it("returns null for unknown ids", async () => {
    expect(await repository.getById(newEntityId())).toBeNull();
  });

  it("increments the version on update", async () => {
    const note = new Note(newEntityId(), "draft");
    await repository.add(note);

    note.text = "final";
    expect(await repository.update(note)).toBe(true);

    const loaded = await repository.getById(note.id);
    expect(loaded?.text).toBe("final");
    expect(loaded?.version).toBe(2);
  });

  it("rejects an update made from a stale copy", async () => {
    const note = new Note(newEntityId(), "v1");
    await repository.add(note);
    const staleCopy = (await repository.getById(note.id))!;

    note.text = "v2";
    await repository.update(note);
    staleCopy.text = "conflicting";

    expect(await repository.update(staleCopy)).toBe(false);
    expect(staleCopy.version).toBe(1);
    expect((await repository.getById(note.id))?.text).toBe("v2");
  });

  it("deletes an aggregate", async () => {
    const note = new Note(newEntityId(), "temporary");
    await repository.add(note);

    expect(await repository.delete(note.id)).toBe(true);
    expect(await repository.delete(note.id)).toBe(false);
    expect(await repository.getById(note.id)).toBeNull();
  });
});
