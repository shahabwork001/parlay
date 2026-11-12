import Link from "next/link";
import { CONTACT, TERMS_EFFECTIVE_DATE, TERMS_VERSION } from "@/lib/legal";
import { LegalDocument } from "./legal-document";

export function TermsContent() {
  return (
    <LegalDocument
      title="Terms of Service"
      updated={`${TERMS_EFFECTIVE_DATE} (version ${TERMS_VERSION})`}
      intro="These terms govern your use of Parley. By starting a chat or creating an account you agree to them and to the Community Guidelines."
    >
      <h2>1. Who can use Parley</h2>
      <p>
        Parley is strictly for adults. You must be at least 18 years old, and old enough to agree to
        these terms where you live. If we have reason to believe you are under 18, we suspend access
        immediately.
      </p>

      <h2>2. Your conduct</h2>
      <p>
        You must follow the <Link href="/guidelines">Community Guidelines</Link>. General Chat
        prohibits explicit sexual content. Adult Chat permits consensual adult sexual expression
        only after verified age and explicit consent for the session; it is unavailable until
        verification is configured. Neither mode allows harassment, hate, threats, exploitation,
        content involving minors, spam or advertising, and no sharing of other people&apos;s
        personal information. You are responsible for what you say and show.
      </p>

      <h2>3. Moderation and reports</h2>
      <p>
        General Chat uses on-device nudity screening. Adult Chat does not treat consensual nudity as
        a violation. Reports and enforcement against minors, coercion and other prohibited activity
        apply in both modes. When someone reports you, the report includes a single still image
        captured from the video at that moment and the last few text messages of the conversation.
        These are kept only as report evidence, as described in the{" "}
        <Link href="/privacy">Privacy Policy</Link>. Conversations are otherwise never recorded.
      </p>
      <p>
        We may warn you, limit features, or suspend or ban accounts, devices or networks that break
        these terms or the guidelines, temporarily or permanently. You can appeal a ban from the
        notice you see when you try to chat.
      </p>

      <h2>4. Child safety</h2>
      <p>
        We have zero tolerance for any sexual content involving minors. We preserve evidence and
        report such content to the relevant authorities, including the National Center for Missing
        &amp; Exploited Children (NCMEC) where applicable.
      </p>

      <h2>5. Accounts</h2>
      <p>
        You can use Parley without an account. If you create one, keep your password safe and tell
        us at {CONTACT.support} if you think someone else has access to it. Staff accounts must use
        two-factor authentication.
      </p>

      <h2>6. Premium</h2>
      <p>
        Optional paid plans add features such as an ad-free experience and matching preferences.
        Prices, renewal and cancellation terms are shown before you pay. Premium never exempts
        anyone from these terms.
      </p>

      <h2>7. Strangers and risk</h2>
      <p>
        You talk to people you do not know. We cannot verify who they are or what they tell you.
        Never share contact details, money or anything you would not want to be public. See{" "}
        <Link href="/safety">Safety tips</Link>.
      </p>

      <h2>8. Availability and liability</h2>
      <p>
        We work to keep Parley available and reliable but provide it as is, without guarantees. To
        the extent the law allows, we are not liable for what other users say or do, or for indirect
        losses.
      </p>

      <h2>9. Changes</h2>
      <p>
        When these terms change we publish a new version and ask you to accept it before your next
        chat. If you do not agree, stop using Parley.
      </p>

      <h2>10. Contact</h2>
      <p>Questions about these terms: {CONTACT.legal}.</p>
    </LegalDocument>
  );
}
