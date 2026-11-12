import { type z } from "zod";
import { ApiError, problemDetailsSchema } from "./api-error";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions<TSchema extends z.ZodType> {
  method?: HttpMethod;
  body?: unknown;
  schema: TSchema;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  acceptedStatuses?: readonly number[];
}

export interface HttpClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
  /**
   * Called when an authenticated request gets 401 (expired access token). Resolve true after
   * obtaining a new token and the request is retried once.
   */
  onUnauthorized?: () => Promise<boolean>;
  fetchImpl?: typeof fetch;
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly getAccessToken: () => string | null;
  private readonly onUnauthorized: (() => Promise<boolean>) | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.getAccessToken = options.getAccessToken ?? (() => null);
    this.onUnauthorized = options.onUnauthorized;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  async request<TSchema extends z.ZodType>(
    path: string,
    options: RequestOptions<TSchema>,
  ): Promise<z.infer<TSchema>> {
    let response = await this.send(path, options);
    if (response.status === 401 && this.getAccessToken() && (await this.onUnauthorized?.())) {
      response = await this.send(path, options);
    }
    const accepted = options.acceptedStatuses ?? [];

    if (!response.ok && !accepted.includes(response.status)) {
      throw new ApiError(response.status, await readProblem(response));
    }

    const payload: unknown = response.status === 204 ? undefined : await response.json();
    return options.schema.parse(payload);
  }

  private async send<TSchema extends z.ZodType>(
    path: string,
    options: RequestOptions<TSchema>,
  ): Promise<Response> {
    const headers = new Headers({ Accept: "application/json", ...options.headers });
    const token = this.getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (options.body !== undefined) headers.set("Content-Type", "application/json");

    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        credentials: "include",
        signal: options.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new ApiError(0, { title: "Network error", detail: "The server could not be reached." });
    }
  }
}

async function readProblem(response: Response) {
  try {
    const parsed = problemDetailsSchema.safeParse(await response.json());
    if (parsed.success) return parsed.data;
  } catch {
    // Non-JSON error bodies fall through to a generic problem.
  }
  return { status: response.status, title: response.statusText || "Request failed" };
}
