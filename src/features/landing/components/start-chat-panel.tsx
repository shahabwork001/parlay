import Link from "next/link";
import { InterestInput } from "@/features/preferences/components/interest-input";
import { LanguageSelect } from "@/features/preferences/components/language-select";
import { StartChatActions } from "./start-chat-actions";

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
      <StartChatActions />
      <p className="text-xs leading-relaxed text-muted-foreground">
        Parley is for adults 18 and over. Before your first chat you confirm your age and agree to
        the{" "}
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
