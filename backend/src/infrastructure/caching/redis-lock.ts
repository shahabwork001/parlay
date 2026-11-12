import { randomUUID } from "node:crypto";
import type { Redis } from "ioredis";
import { LuaScript } from "./lua-script.js";

const RELEASE_IF_OWNER = new LuaScript(`
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`);

/**
 * Runs `work` on at most one instance at a time (SET NX PX lease). Returns false when another
 * instance holds the lease. The lease expires on its own if the holder dies.
 */
export async function runExclusively(
  redis: Redis,
  name: string,
  leaseMs: number,
  work: () => Promise<void>,
): Promise<boolean> {
  const key = `lock:${name}`;
  const owner = randomUUID();
  if ((await redis.set(key, owner, "PX", leaseMs, "NX")) !== "OK") return false;
  try {
    await work();
    return true;
  } finally {
    await RELEASE_IF_OWNER.run(redis, [key], [owner]);
  }
}
