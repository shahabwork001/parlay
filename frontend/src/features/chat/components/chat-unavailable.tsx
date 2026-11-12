"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { maintenanceMessage, useSiteConfig } from "@/features/site/hooks/use-site-config";
import type { UnavailableReason } from "../store/chat-store";

const COPY: Record<Exclude<UnavailableReason, "maintenance">, { title: string; body: string }> = {
  terms: {
    title: "Please review the updated Terms",
    body: "The Terms changed since you last accepted them. Accept the current version to keep chatting.",
  },
  session: {
    title: "Start from the home page",
    body: "Confirm you are 18 or older and accept the Terms before your first chat.",
  },
};

/** Shown instead of a chat when it cannot start; shared by text and video chat. */
export function ChatUnavailable({ reason }: { reason: UnavailableReason | null }) {
  const site = useSiteConfig();
  const copy =
    reason === "maintenance"
      ? { title: "Chat is paused for maintenance", body: maintenanceMessage(site) }
      : COPY[reason ?? "session"];
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-start justify-center gap-4 px-4 py-16">
      <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="text-sm text-muted-foreground">{copy.body}</p>
      <Button asChild>
        <Link href="/">Go to start</Link>
      </Button>
    </div>
  );
}
