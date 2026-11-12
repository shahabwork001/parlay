"use client";
import { useEffect } from "react";
import { useSession } from "@/features/auth/hooks/use-session";
import { mvpRepository } from "@/repositories/mvp-repository";
export function ActivityTracker() {
  const { principal } = useSession();
  useEffect(() => {
    if (!principal) return;
    const record = () => {
      if (document.visibilityState === "visible")
        void mvpRepository.activity().catch(() => undefined);
    };
    record();
    const timer = window.setInterval(record, 15 * 60_000);
    document.addEventListener("visibilitychange", record);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", record);
    };
  }, [principal]);
  return null;
}
