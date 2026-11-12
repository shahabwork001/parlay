import { refreshSession } from "@/lib/auth/refresh-session";
import { sessionStore } from "@/lib/auth/session-store";
import { publicConfig } from "@/lib/config";
import { HttpClient } from "./http-client";

export { ApiError, type ProblemDetails } from "./api-error";
export { HttpClient } from "./http-client";

export const httpClient = new HttpClient({
  baseUrl: publicConfig.apiBaseUrl,
  getAccessToken: () => sessionStore.getState().session?.accessToken ?? null,
  onUnauthorized: refreshSession,
});
