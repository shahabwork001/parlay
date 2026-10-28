import { Emitter } from "@socket.io/redis-emitter";
import type { Redis } from "ioredis";
import { BANNED_EVENT, roomForBanTarget } from "../../application/features/chat/rooms.js";
import type { BanEnforcer } from "../../application/features/moderation/ports.js";
import type { BanTarget } from "../../domain/moderation/ban.js";

/**
 * Reaches sockets on every API instance through the Socket.IO Redis adapter channel, so the workers
 * can enforce bans too. Sockets get the ban notice, then are disconnected; reconnecting is refused.
 */
export class SocketBanEnforcer implements BanEnforcer {
  readonly #emitter: Emitter;

  constructor(redis: Redis) {
    this.#emitter = new Emitter(redis);
  }

  enforce(targets: readonly BanTarget[]): Promise<void> {
    const rooms = targets.map(roomForBanTarget);
    if (rooms.length === 0) return Promise.resolve();
    this.#emitter.to(rooms).emit(BANNED_EVENT, {});
    this.#emitter.in(rooms).disconnectSockets(true);
    return Promise.resolve();
  }
}
