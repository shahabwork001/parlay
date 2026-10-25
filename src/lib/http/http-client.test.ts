import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError } from "./api-error";
import { HttpClient } from "./http-client";

const schema = z.object({ value: z.string() });

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("HttpClient", () => {
  it("parses successful responses with the provided schema", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ value: "ok" }));
    const client = new HttpClient({ baseUrl: "http://api.test/", fetchImpl });

    await expect(client.request("/thing", { schema })).resolves.toEqual({ value: "ok" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://api.test/thing",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });

  it("attaches the bearer token when one is available", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ value: "ok" }));
    const client = new HttpClient({
      baseUrl: "http://api.test",
      fetchImpl,
      getAccessToken: () => "token-123",
    });

    await client.request("/thing", { schema });

    const headers = fetchImpl.mock.calls[0]?.[1]?.headers;
    expect(headers).toBeInstanceOf(Headers);
    expect((headers as Headers).get("Authorization")).toBe("Bearer token-123");
  });

  it("throws an ApiError carrying ProblemDetails for failed responses", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ title: "Validation failed", status: 400, detail: "Bad input" }, 400),
      );
    const client = new HttpClient({ baseUrl: "http://api.test", fetchImpl });

    const error = await client.request("/thing", { schema }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).message).toBe("Bad input");
  });

  it("returns the body for explicitly accepted error statuses", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ value: "down" }, 503));
    const client = new HttpClient({ baseUrl: "http://api.test", fetchImpl });

    await expect(client.request("/thing", { schema, acceptedStatuses: [503] })).resolves.toEqual({
      value: "down",
    });
  });

  it("maps transport failures to a network ApiError", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));
    const client = new HttpClient({ baseUrl: "http://api.test", fetchImpl });

    const error = await client.request("/thing", { schema }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isNetworkError).toBe(true);
  });
});

describe("HttpClient token refresh", () => {
  it("refreshes once and retries an authenticated request that got 401", async () => {
    let token = "expired";
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ title: "Unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ value: "ok" }));
    const onUnauthorized = vi.fn(() => {
      token = "fresh";
      return Promise.resolve(true);
    });
    const client = new HttpClient({
      baseUrl: "http://api.test",
      fetchImpl,
      getAccessToken: () => token,
      onUnauthorized,
    });

    await expect(client.request("/thing", { schema })).resolves.toEqual({ value: "ok" });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect((fetchImpl.mock.calls[1]?.[1]?.headers as Headers).get("Authorization")).toBe(
      "Bearer fresh",
    );
  });

  it("does not try to refresh anonymous requests", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ title: "Unauthorized" }, 401));
    const onUnauthorized = vi.fn(() => Promise.resolve(true));
    const client = new HttpClient({ baseUrl: "http://api.test", fetchImpl, onUnauthorized });

    await expect(client.request("/thing", { schema })).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
