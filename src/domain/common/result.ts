import type { AppError } from "./app-error.js";

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/** Result pattern for expected failures. Exceptions are reserved for exceptional cases. */
export type Result<T, E = AppError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

export const okVoid = (): Ok<undefined> => ({ ok: true, value: undefined });

export const fail = <E = AppError>(error: E): Err<E> => ({ ok: false, error });
