import { publicConfig } from "@/lib/config";
import { ApiError } from "@/lib/http/api-error";
import { HttpClient } from "@/lib/http/http-client";
import { sessionResponseSchema } from "@/lib/schemas/auth";
import { clearSession, setSession } from "./session-store";

/** A bare client: refreshing must never trigger another refresh. */
const refreshClient = new HttpClient({ baseUrl: publicConfig.apiBaseUrl });

let inFlight: Promise<boolean> | null = null;

async function refreshNow(): Promise<boolean> {
  try {
    setSession(
      await refreshClient.request("/api/v1/auth/refresh", {
        method: "POST",
        schema: sessionResponseSchema,
      }),
    );
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) clearSession();
    return false;
  }
}

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers in this tab share one
 * request, and a Web Lock serialises refreshes across tabs: each refresh rotates the cookie, so two
 * tabs sending the same cookie at once would look like token theft to the server.
 */
async function refreshExclusively(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("locks" in navigator)) return refreshNow();
  return await navigator.locks.request("parley.session-refresh", refreshNow);
}

export function refreshSession(): Promise<boolean> {
  inFlight ??= refreshExclusively().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
