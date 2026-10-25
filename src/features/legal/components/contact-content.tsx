import { CONTACT } from "@/lib/legal";
import { LegalDocument } from "./legal-document";

const CHANNELS = [
  { label: "General support and account questions", address: CONTACT.support },
  { label: "Safety concerns and urgent reports", address: CONTACT.safety },
  { label: "Privacy and data requests", address: CONTACT.privacy },
  { label: "Legal and law enforcement", address: CONTACT.legal },
] as const;

export function ContactContent() {
  return (
    <LegalDocument
      title="Contact"
      intro="For anything that happened in a chat, the Report button is the fastest way to reach a moderator."
    >
      <ul className="!list-none divide-y rounded-xl border !pl-0">
        {CHANNELS.map((channel) => (
          <li
            key={channel.address}
            className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-sm text-muted-foreground">{channel.label}</span>
            <a href={`mailto:${channel.address}`} className="text-sm font-medium">
              {channel.address}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        We answer support email within two business days. Safety reports are reviewed around the
        clock.
      </p>
    </LegalDocument>
  );
}
