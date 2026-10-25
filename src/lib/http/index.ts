import { publicConfig } from "@/lib/config";
import { HttpClient } from "./http-client";

export { ApiError, type ProblemDetails } from "./api-error";
export { HttpClient } from "./http-client";

export const httpClient = new HttpClient({ baseUrl: publicConfig.apiBaseUrl });
