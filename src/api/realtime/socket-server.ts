import type { Server as HttpServer } from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { Server, type Socket } from "socket.io";
import type { AccessTokenService } from "../../application/features/identity/ports.js";
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
} as const;

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
    pingInterval: 10_000,
    pingTimeout: 10_000,
    maxHttpBufferSize: 64 * 1024,
    serveClient: false,
  });

  io.use((socket, next) => {
    const auth = socket.handshake.auth as { token?: unknown } | undefined;
    const token = typeof auth?.token === "string" ? auth.token : null;
    void (token ? options.accessTokens.verify(token) : Promise.resolve(null)).then((principal) => {
      if (!principal) {
        next(new Error(CONNECT_ERRORS.authRequired));
        return;
      }
      if (principal.termsVersion !== options.termsVersion) {
        next(new Error(CONNECT_ERRORS.termsOutdated));
        return;
      }
      socket.data.principal = principal;
      next();
    });
  });

  return {
    io,
    async close() {
      await io.close();
      await Promise.allSettled([publisher.quit(), subscriber.quit()]);
    },
  };
}
