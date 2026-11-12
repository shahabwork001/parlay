import type { Server as HttpServer } from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import proxyaddr from "proxy-addr";
import { Server, type Socket } from "socket.io";
import type { AccessTokenService, KeyedHasher } from "../../application/features/identity/ports.js";
import type { BanService } from "../../application/features/moderation/bans.js";
import { networkHashes } from "../../application/features/moderation/network.js";
import type { SiteConfigProvider } from "../../application/features/site/site-config.js";
import type { Logger } from "../../infrastructure/observability/logger.js";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./chat-events.js";

export type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export interface SocketServerOptions {
  readonly corsAllowedOrigins: readonly string[];
  readonly redisUrl: string;
  readonly accessTokens: AccessTokenService;
  readonly termsVersion: string;
  readonly bans: BanService;
  readonly siteConfig: SiteConfigProvider;
  readonly hasher: KeyedHasher;
  /** Same value as Express `trust proxy`, so sockets see the same client address as HTTP. */
  readonly trustProxy: string;
  readonly logger: Logger;
}

export interface SocketServerHandle {
  readonly io: ChatServer;
  close(): Promise<void>;
}

/** Error codes delivered to the client as `connect_error.message`. */
export const CONNECT_ERRORS = {
  authRequired: "auth.required",
  termsOutdated: "terms.outdated",
  banned: "moderation.banned",
  maintenance: "site.maintenance",
} as const;

/** Compiles an Express-style `trust proxy` value (true, a hop count, or address/subnet names). */
export function compileTrust(value: string): (address: string, hop: number) => boolean {
  if (value === "true") return () => true;
  if (value === "false") return () => false;
  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    return (_address, hop) => hop < hops;
  }
  return proxyaddr.compile(value.split(",").map((item) => item.trim()));
}

/**
 * Socket.IO server. The Redis adapter fans events out across API instances, so emitting to a
 * subject's room reaches that person wherever they are connected.
 */
export function createSocketServer(httpServer: HttpServer, options: SocketServerOptions): SocketServerHandle {
  const publisher = new Redis(options.redisUrl, { connectionName: "parley-socket-pub" });
  const subscriber = publisher.duplicate({ connectionName: "parley-socket-sub" });
  for (const client of [publisher, subscriber]) {
    client.on("error", (error: Error) => {
      options.logger.warn({ err: error }, "Socket.IO adapter Redis error");
    });
  }

  const io: ChatServer = new Server(httpServer, {
    cors: { origin: [...options.corsAllowedOrigins], credentials: true },
    adapter: createAdapter(publisher, subscriber),
    transports: ["websocket"],
    pingInterval: 10_000,
    pingTimeout: 10_000,
    maxHttpBufferSize: 64 * 1024,
    serveClient: false,
  });

  const trust = compileTrust(options.trustProxy);
  io.use((socket, next) => {
    const auth = socket.handshake.auth as { token?: unknown } | undefined;
    const token = typeof auth?.token === "string" ? auth.token : null;
    const admit = async () => {
      const principal = token ? await options.accessTokens.verify(token) : null;
      if (!principal) return CONNECT_ERRORS.authRequired;
      if (principal.termsVersion !== options.termsVersion) return CONNECT_ERRORS.termsOutdated;
      // Staff can still connect during maintenance, to check the site before reopening it.
      if (principal.roles.length === 0 && (await options.siteConfig.current()).maintenance.enabled)
        return CONNECT_ERRORS.maintenance;

      const identity = {
        kind: principal.kind,
        subjectId: principal.subjectId,
        deviceId: principal.deviceId,
        ...networkHashes(proxyaddr(socket.request, trust), options.hasher),
      };
      const access = await options.bans.checkAccess(identity);
      if (access.status === "banned") return CONNECT_ERRORS.banned;
      socket.data.principal = principal;
      socket.data.identity = identity;
      return null;
    };
    admit().then(
      (error) => {
        next(error ? new Error(error) : undefined);
      },
      (error: unknown) => {
        options.logger.error({ err: error }, "Socket admission failed");
        next(new Error("internal"));
      },
    );
  });

  return {
    io,
    async close() {
      await io.close();
      await Promise.allSettled([publisher.quit(), subscriber.quit()]);
    },
  };
}
