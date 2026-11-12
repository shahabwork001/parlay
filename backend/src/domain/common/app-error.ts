export type ErrorType =
  "failure" | "validation" | "not_found" | "conflict" | "unauthorized" | "forbidden" | "rate_limited";

/** An expected failure. `code` is stable and machine-readable; `message` is for humans. */
export interface AppError {
  readonly code: string;
  readonly message: string;
  readonly type: ErrorType;
}

const make =
  (type: ErrorType) =>
  (code: string, message: string): AppError => ({ code, message, type });

export const AppErrors = {
  failure: make("failure"),
  validation: make("validation"),
  notFound: make("not_found"),
  conflict: make("conflict"),
  unauthorized: make("unauthorized"),
  forbidden: make("forbidden"),
  rateLimited: make("rate_limited"),
} as const;
