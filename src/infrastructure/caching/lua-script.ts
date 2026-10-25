import { createHash } from "node:crypto";
import type { Redis } from "ioredis";

/**
 * A Lua script run with EVALSHA (cached on the server), falling back to EVAL when the script cache
 * was flushed (e.g. after a Redis restart). Scripts run atomically: no other command interleaves.
 */
export class LuaScript {
  readonly #sha: string;

  constructor(private readonly source: string) {
    this.#sha = createHash("sha1").update(source).digest("hex");
  }

  async run(redis: Redis, keys: readonly string[], args: readonly (string | number)[]): Promise<unknown> {
    try {
      return await redis.evalsha(this.#sha, keys.length, ...keys, ...args);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("NOSCRIPT")) {
        return redis.eval(this.source, keys.length, ...keys, ...args);
      }
      throw error;
    }
  }
}
