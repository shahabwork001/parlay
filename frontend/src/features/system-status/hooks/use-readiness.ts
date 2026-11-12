"use client";

import { useQuery } from "@tanstack/react-query";
import { systemRepository } from "@/repositories/system-repository";

const REFRESH_INTERVAL_MS = 15_000;

export function useReadiness() {
  return useQuery({
    queryKey: ["system", "readiness"],
    queryFn: ({ signal }) => systemRepository.getReadiness(signal),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
}
