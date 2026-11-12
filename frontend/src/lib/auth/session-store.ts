import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { SessionPrincipal, SessionResponse } from "@/lib/schemas/auth";

export interface Session {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
  readonly principal: SessionPrincipal;
}

/**
 * - `restoring`: checking the refresh cookie on first load
 * - `ready`: done; `session` is null when signed out
 */
export type SessionStatus = "restoring" | "ready";

interface SessionState {
  readonly status: SessionStatus;
  readonly session: Session | null;
}

/**
 * The access token lives only in memory (never localStorage) to limit XSS exposure; the httpOnly
 * refresh cookie restores it after a reload.
 */
export const sessionStore = createStore<SessionState>()(() => ({
  status: "restoring",
  session: null,
}));

export function setSession(response: SessionResponse): void {
  sessionStore.setState({
    status: "ready",
    session: {
      accessToken: response.accessToken,
      accessTokenExpiresAt: new Date(response.accessTokenExpiresAt),
      principal: response.principal,
    },
  });
}

export function updateAccessToken(
  accessToken: string,
  expiresAt: string,
  termsVersion: string,
): void {
  const current = sessionStore.getState().session;
  if (!current) return;
  sessionStore.setState({
    session: {
      accessToken,
      accessTokenExpiresAt: new Date(expiresAt),
      principal: { ...current.principal, termsVersion },
    },
  });
}

export function clearSession(): void {
  sessionStore.setState({ status: "ready", session: null });
}

/** Resolves once the initial cookie-based restore has finished (immediately if it already has). */
export function whenSessionReady(): Promise<void> {
  if (sessionStore.getState().status === "ready") return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = sessionStore.subscribe((state) => {
      if (state.status !== "ready") return;
      unsubscribe();
      resolve();
    });
  });
}

export const useSessionState = (): SessionState => useStore(sessionStore);
