import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InterestInput } from "@/features/preferences/components/interest-input";
import { LanguageSelect } from "@/features/preferences/components/language-select";

export function StartChatPanel() {
  return (
    <section
      aria-labelledby="start-chat-heading"
      className="flex flex-col gap-6 rounded-xl border bg-card p-6"
    >
      <h2 id="start-chat-heading" className="text-base font-medium">
        Start a conversation
      </h2>
      <InterestInput />
      <LanguageSelect />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button asChild size="lg">
          <Link href="/chat/video">Start video</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/chat/text">Start text</Link>
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        By starting a chat you confirm you are 18 or older and agree to the{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/guidelines" className="underline underline-offset-2 hover:text-foreground">
          Community Guidelines
        </Link>
        .
      </p>
    </section>
  );
}
