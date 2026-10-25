"use client";

import { Button } from "@/components/ui/button";
import { TermsGateDialog } from "@/features/terms-gate/components/terms-gate-dialog";
import { useStartChat } from "@/features/terms-gate/hooks/use-start-chat";

export function StartChatActions() {
  const { start, accept, cancel, gateOpen, submitting, error } = useStartChat();

  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button size="lg" onClick={() => void start("video")}>
          Start video
        </Button>
        <Button size="lg" variant="outline" onClick={() => void start("text")}>
          Start text
        </Button>
      </div>
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
