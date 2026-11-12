"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/hooks/use-session";
import { accountRepository } from "@/repositories/account-repository";

export const accountQueryKey = ["account", "current"] as const;

export function useAccount() {
  const { session } = useSession();
  return useQuery({
    queryKey: accountQueryKey,
    queryFn: ({ signal }) => accountRepository.getCurrent(signal),
    enabled: session !== null,
  });
}
