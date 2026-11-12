import { CONTACT, TERMS_EFFECTIVE_DATE } from "@/lib/legal";
import { LegalDocument } from "./legal-document";

export function PrivacyContent() {
  return (
    <LegalDocument
      title="Privacy Policy"
      updated={TERMS_EFFECTIVE_DATE}
      intro="Parley is built to collect as little as possible. This page explains exactly what we keep, why, and for how long."
    >
      <h2>What we never store</h2>
      <ul>
        <li>
          <strong>Video and audio.</strong> Calls connect directly between browsers or through an
          encrypted relay. We never record them.
        </li>
        <li>
          <strong>Full chat logs.</strong> Text messages are relayed in real time and not saved. To
          make reporting possible, the last few messages of a live chat are held in memory for up to
          15 minutes and then discarded; they are only kept if someone reports the chat.
        </li>
        <li>
          <strong>Your camera picture, for screening.</strong> Video is checked for nudity on your
          own device, by a model that runs in your browser. Frames are never uploaded; we only learn
          that a check flagged your video, and your partner then sees it blurred.
        </li>
        <li>
          <strong>Your IP address, shown to anyone.</strong> Other users never see it. You can force
          all video through our relay so that peers cannot learn it either.
        </li>
      </ul>

      <h2>What we do store</h2>
      <ul>
        <li>
          <strong>A device identifier.</strong> Your browser sends a one-way fingerprint, which we
          hash again with a secret key before storing. We use it to apply bans to people who chat
          without an account. It cannot be turned back into information about your device.
        </li>
        <li>
          <strong>Your confirmation of age and the Terms</strong>, with the date and the version you
          accepted.
        </li>
        <li>
          <strong>Account details</strong>, if you create an account: your email address, a hash of
          your password (we cannot read it) and, if enabled, your two-factor settings.
        </li>
        <li>
          <strong>Report evidence.</strong> When someone reports a conversation, we keep one still
          image from the video at that moment and the last few text messages, so a moderator can
          review it. Evidence is deleted automatically after 30 days. Evidence in reports about
          minors is preserved for one year, because we must keep it for reports to child-protection
          authorities. Every time staff view evidence, it is recorded in an audit log.
        </li>
        <li>
          <strong>Moderation records</strong>, such as warnings, bans and appeals, a trust score
          that rises with ordinary chats and falls with valid reports, and an audit log of staff
          actions. Bans on a network use a keyed hash of the IP address, never the address itself.
        </li>
        <li>
          <strong>Operational data</strong>: aggregated usage statistics and short-lived technical
          logs. Logs do not contain IP addresses, message content or email addresses.
        </li>
      </ul>

      <h2>Why we process it</h2>
      <p>
        To run the service you asked for, to keep it safe (moderation, abuse prevention, child
        protection), to meet legal obligations, and, for premium plans, to bill you.
      </p>

      <h2>Who we share it with</h2>
      <p>
        We do not sell personal data and we do not use third-party advertising or analytics
        trackers. We share report evidence with law enforcement or child-protection organisations
        (such as NCMEC) only when the law requires it or a child may be at risk.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>Use Parley without an account.</li>
        <li>Ask for a copy of your account data, or for it to be corrected or deleted.</li>
        <li>Object to processing, or complain to your data protection authority.</li>
      </ul>
      <p>Write to {CONTACT.privacy}. We answer within 30 days.</p>

      <h2>Cookies and local storage</h2>
      <p>
        We use one essential cookie to keep you signed in, and local storage for your preferences
        (interests, language, theme) and the device identifier. No advertising or tracking cookies.
      </p>
    </LegalDocument>
  );
}
