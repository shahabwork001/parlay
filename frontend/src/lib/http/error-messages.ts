import { ApiError } from "./api-error";

/** A message that is safe and useful to show for any failed request. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isNetworkError)
      return "We could not reach Parley. Check your connection and try again.";
    if (error.status === 429 && !error.problem.errorCode?.startsWith("auth.")) {
      return "Too many attempts. Wait a moment and try again.";
    }
    if (error.status >= 500) return "Something went wrong on our side. Try again in a moment.";
    return error.problem.detail ?? error.problem.title ?? "The request could not be completed.";
  }
  return "Something went wrong. Try again.";
}

export const errorCode = (error: unknown): string | undefined =>
  error instanceof ApiError ? error.problem.errorCode : undefined;

/** Field errors from a 400 response, keyed by field name (`body.email` becomes `email`). */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !error.problem.errors) return {};
  return Object.fromEntries(
    Object.entries(error.problem.errors).map(([key, messages]) => [
      key.replace(/^body\./, ""),
      messages[0] ?? "",
    ]),
  );
}
