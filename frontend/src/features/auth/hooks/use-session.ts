"use client";

import { useSessionState } from "@/lib/auth/session-store";

export function useSession() {
  const { status, session } = useSessionState();
  const principal = session?.principal ?? null;
  return {
    status,
    session,
    principal,
    isRestoring: status === "restoring",
    isSignedIn: principal?.kind === "user",
    isStaff: (principal?.roles.length ?? 0) > 0,
  };
}
