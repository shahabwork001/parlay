import { GroundRules } from "./ground-rules";
import { PlatformPrinciples } from "./platform-principles";
import { StartChatPanel } from "./start-chat-panel";

export function LandingPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 py-12 sm:px-6 sm:py-20">
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Talk to someone new.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
              Parley pairs you with a random adult for a video or text conversation. No account
              needed for General Chat. Leave or report at any time. Parley does not record calls;
              reports may retain a snapshot and recent messages.
            </p>
          </div>
          <GroundRules />
        </div>
        <StartChatPanel />
      </div>
      <PlatformPrinciples />
    </div>
  );
}
