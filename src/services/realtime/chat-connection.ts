import { io, type Socket } from "socket.io-client";
import { refreshSession } from "@/lib/auth/refresh-session";
import { sessionStore } from "@/lib/auth/session-store";
import { publicConfig } from "@/lib/config";
import {
  CONNECT_ERRORS,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "./chat-events";

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Opens the chat socket. The access token is read at every (re)connection attempt, and an
 * `auth.required` rejection triggers one session refresh before retrying, so expired tokens heal
 * themselves. Reconnection uses Socket.IO's exponential backoff with jitter.
 */
export function openChatConnection(onFatalError: (code: string) => void): ChatSocket {
  const socket: ChatSocket = io(publicConfig.apiBaseUrl, {
    autoConnect: false,
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
    auth: (callback) => {
      callback({ token: sessionStore.getState().session?.accessToken ?? "" });
    },
  });

  let refreshedForThisFailure = false;
  socket.on("connect", () => {
    refreshedForThisFailure = false;
  });
  socket.on("connect_error", (error) => {
    if (error.message === CONNECT_ERRORS.authRequired && !refreshedForThisFailure) {
      refreshedForThisFailure = true;
      void refreshSession().then((refreshed) => {
        if (refreshed) socket.connect();
        else onFatalError(CONNECT_ERRORS.authRequired);
      });
      return;
    }
    if (
      error.message === CONNECT_ERRORS.termsOutdated ||
      error.message === CONNECT_ERRORS.authRequired ||
      error.message === CONNECT_ERRORS.banned
    ) {
      onFatalError(error.message);
    }
  });

  socket.connect();
  return socket;
}
