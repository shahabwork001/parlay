"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  sessionStore,
  setSession,
  updateAccessToken,
  whenSessionReady,
} from "@/lib/auth/session-store";
import type { ChatMode } from "@/lib/constants";
import { errorMessage } from "@/lib/http/error-messages";
import { TERMS_VERSION } from "@/lib/legal";
import { accountRepository } from "@/repositories/account-repository";
import { authRepository } from "@/repositories/auth-repository";
import { getDeviceFingerprint } from "@/services/device-identity";

const hasCurrentAcceptance = () =>
  sessionStore.getState().session?.principal.termsVersion === TERMS_VERSION;

/**
 * Entry point to chat. Sessions that already accepted the current Terms go straight in; everyone
 * else passes the 18+ and Terms gate, which records acceptance on the account or creates an
 * anonymous device session.
 */
export function useStartChat() {
  const router = useRouter();
  const [pendingMode, setPendingMode] = useState<ChatMode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enter = useCallback((mode: ChatMode) => router.push(`/chat/${mode}`), [router]);

  const start = useCallback(
    async (mode: ChatMode) => {
      await whenSessionReady();
      if (hasCurrentAcceptance()) {
        enter(mode);
        return;
      }
      setError(null);
      setPendingMode(mode);
    },
    [enter],
  );

  const accept = useCallback(async () => {
    if (!pendingMode) return;
    setSubmitting(true);
    setError(null);
    try {
      if (sessionStore.getState().session) {
        const token = await accountRepository.acceptCurrentTerms();
        updateAccessToken(token.accessToken, token.accessTokenExpiresAt, TERMS_VERSION);
      } else {
        setSession(await authRepository.startAnonymousSession(await getDeviceFingerprint()));
      }
      const mode = pendingMode;
      setPendingMode(null);
      enter(mode);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }, [enter, pendingMode]);

  const cancel = useCallback(() => setPendingMode(null), []);

  return { start, accept, cancel, gateOpen: pendingMode !== null, submitting, error };
}
