import { CONTACT } from "@/lib/legal";
import { LegalDocument } from "./legal-document";

export function SafetyContent() {
  return (
    <LegalDocument
      title="Safety tips"
      intro="You are talking to strangers. These habits keep conversations fun and keep you in control."
    >
      <h2>Protect your identity</h2>
      <ul>
        <li>
          Do not share your full name, address, school, workplace, phone number or social media.
        </li>
        <li>
          Check what your camera shows: mail, photos, windows and screens can reveal where you are.
        </li>
        <li>Use a first name or a nickname.</li>
        <li>
          Turn on relay-only video in Settings if you want to make sure no one can learn your IP
          address.
        </li>
      </ul>

      <h2>Stay in control</h2>
      <ul>
        <li>
          Press Next or Esc to leave any conversation, at any time. You never owe anyone an
          explanation.
        </li>
        <li>Report anything that breaks the rules. The person cannot contact you again.</li>
        <li>
          Remember that anyone can screen-record. Do not show or say anything you would not want
          public.
        </li>
      </ul>

      <h2>Common scams</h2>
      <ul>
        <li>
          Requests to move to another app, often followed by blackmail or a fake
          &ldquo;verification&rdquo;.
        </li>
        <li>Requests for money, gift cards, crypto or codes sent to your phone.</li>
        <li>Links to &ldquo;see more&rdquo; or to claim prizes.</li>
      </ul>
      <p>
        If someone threatens to share images of you, do not pay. Stop responding, keep evidence, and
        contact local police. In the United States, NCMEC&apos;s Take It Down service helps remove
        images of people who were under 18 when they were taken.
      </p>

      <h2>Getting help</h2>
      <p>
        If you are in danger, contact local emergency services. For safety concerns about Parley,
        write to {CONTACT.safety}.
      </p>
    </LegalDocument>
  );
}
