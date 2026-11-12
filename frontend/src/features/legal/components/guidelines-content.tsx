import { TERMS_EFFECTIVE_DATE, TERMS_VERSION } from "@/lib/legal";
import { LegalDocument } from "./legal-document";

export function GuidelinesContent() {
  return (
    <LegalDocument
      title="Community Guidelines"
      updated={`${TERMS_EFFECTIVE_DATE} (version ${TERMS_VERSION})`}
      intro="Parley works when people treat each other with basic respect. These rules apply to every conversation, video or text."
    >
      <h2>Not allowed</h2>
      <ol>
        <li>
          <strong>Anyone under 18.</strong> If someone appears to be a minor, end the chat and
          report it with &ldquo;Appears to be a minor&rdquo;. These reports are reviewed first.
        </li>
        <li>
          <strong>Unwanted sexual content.</strong> Explicit content is prohibited in General Chat.
          Adult Chat permits consensual adult nudity and sexual expression only for age-verified
          participants who explicitly opt in for that session. Consent to the mode is not consent to
          every activity. Stop or leave to withdraw; never pressure a participant. Adult Chat
          remains unavailable until age verification is configured.
        </li>
        <li>
          <strong>Harassment and hate</strong>: insults, threats, slurs, or attacks on
          someone&apos;s race, ethnicity, religion, nationality, gender, sexual orientation,
          disability or age.
        </li>
        <li>
          <strong>Violence and self-harm</strong>: showing or encouraging violence, weapons used to
          threaten, or self-harm.
        </li>
        <li>
          <strong>Illegal activity</strong>, including drugs sales, fraud and scams.
        </li>
        <li>
          <strong>Spam and advertising</strong>: links, promotions, repeated messages, or steering
          people to other platforms.
        </li>
        <li>
          <strong>Personal information</strong>: asking for or sharing phone numbers, addresses,
          social handles or other identifying details, yours or anyone else&apos;s.
        </li>
        <li>
          <strong>Recording or impersonation</strong>: recording other people without consent, or
          pretending to be someone else, including staff.
        </li>
      </ol>

      <h2>What happens when rules are broken</h2>
      <p>
        Automated screening and reports from other users reach our moderators. Depending on severity
        and history, the result can be a warning, a temporary ban or a permanent ban of the account,
        device or network. Child-safety violations lead to an immediate ban and a report to the
        authorities.
      </p>

      <h2>Reporting</h2>
      <p>
        Use the Report button during a chat. The conversation ends immediately, and you will never
        be matched with that person again. A still image and the last few messages are attached so a
        moderator can review what happened. False reports are themselves a violation.
      </p>

      <h2>Appeals</h2>
      <p>
        If you believe a ban was a mistake, appeal from the ban notice. A different moderator
        reviews each appeal.
      </p>
    </LegalDocument>
  );
}
