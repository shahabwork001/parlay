import type { Request, RequestHandler } from "express";
import type { RateLimiter } from "../../application/abstractions/rate-limiter.js";
import type { KeyedHasher } from "../../application/features/identity/ports.js";
import { sendProblem } from "../http/problem-details.js";

export interface RateLimitRule {
  /** Bucket name, part of the Redis key (e.g. `auth.login`). */
  readonly name: string;
  readonly limit: number;
  readonly windowMs: number;
}

export interface RateLimitDependencies {
  readonly limiter: RateLimiter;
  readonly hasher: KeyedHasher;
}

/** Client IP, hashed so raw addresses never reach Redis. */
const clientKey = (request: Request, hasher: KeyedHasher) => hasher.hash("ip", request.ip ?? "unknown");

/**
 * Per-IP sliding-window limit. Fails open when Redis is unavailable (logged), because account
 * lockout and validation still protect the endpoints behind it.
 */
export function rateLimit(dependencies: RateLimitDependencies, rule: RateLimitRule): RequestHandler {
  return async (request, response, next) => {
    try {
      const key = `${rule.name}:${clientKey(request, dependencies.hasher)}`;
      const decision = await dependencies.limiter.consume(key, rule.limit, rule.windowMs);
      response.set("RateLimit-Limit", String(rule.limit));
      response.set("RateLimit-Remaining", String(decision.remaining));
      if (!decision.allowed) {
        response.set("Retry-After", String(Math.ceil(decision.retryAfterMs / 1000)));
        sendProblem(request, response, {
          status: 429,
          detail: "Too many requests. Wait a moment and try again.",
          errorCode: "rate_limited",
        });
        return;
      }
    } catch (error) {
      request.log.warn({ err: error, rule: rule.name }, "Rate limiter unavailable; allowing request");
    }
    next();
  };
}
