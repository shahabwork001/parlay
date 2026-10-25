import { MongoServerError } from "mongodb";
import { UniqueConstraintViolationError } from "../../../application/abstractions/persistence/errors.js";

const DUPLICATE_KEY = 11000;

/** Runs a write and translates duplicate-key failures into the application-level error. */
export async function translateDuplicateKey<T>(constraint: string, write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
      throw new UniqueConstraintViolationError(constraint);
    }
    throw error;
  }
}
