"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { clearSession } from "@/lib/auth/session-store";
import { authRepository } from "@/repositories/auth-repository";

export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    try {
      await authRepository.logout();
    } finally {
      clearSession();
      queryClient.clear();
      router.push("/");
    }
  }, [queryClient, router]);
}
