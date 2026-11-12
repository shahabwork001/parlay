"use client";

import { useEffect } from "react";
import { refreshSession } from "@/lib/auth/refresh-session";
import { clearSession, sessionStore } from "@/lib/auth/session-store";

/** Restores the session from the httpOnly refresh cookie once per page load. */
export function SessionBootstrap() {
  useEffect(() => {
    if (sessionStore.getState().status !== "restoring") return;
    void refreshSession().then((restored) => {
      if (!restored && sessionStore.getState().status === "restoring") clearSession();
    });
  }, []);
  return null;
}
