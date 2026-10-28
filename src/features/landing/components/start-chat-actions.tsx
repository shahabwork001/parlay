"use client";

import { Button } from "@/components/ui/button";
import { TermsGateDialog } from "@/features/terms-gate/components/terms-gate-dialog";
import { maintenanceMessage, useSiteConfig } from "@/features/site/hooks/use-site-config";
import { useStartChat } from "@/features/terms-gate/hooks/use-start-chat";

export function StartChatActions() {
  const { start, accept, cancel, gateOpen, submitting, error } = useStartChat();
  const site = useSiteConfig();
  const maintenance = site.maintenance.enabled;
  const off = (enabled: boolean) => maintenance || !enabled;
  const notice = maintenance
    ? maintenanceMessage(site)
    : !site.features.videoChat && !site.features.textChat
      ? "Chat is paused right now. Please check back soon."
      : !site.features.videoChat
        ? "Video chat is paused right now; text chat is open."
        : !site.features.textChat
          ? "Text chat is paused right now; video chat is open."
          : null;

  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          size="lg"
          disabled={off(site.features.videoChat)}
          onClick={() => void start("video")}
        >
          Start video
        </Button>
        <Button
          size="lg"
          variant="outline"
          disabled={off(site.features.textChat)}
          onClick={() => void start("text")}
        >
          Start text
        </Button>
      </div>
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      <TermsGateDialog
        key={gateOpen ? "open" : "closed"}
        open={gateOpen}
        submitting={submitting}
        error={error}
        onAccept={() => void accept()}
        onCancel={cancel}
      />
    </>
  );
}
