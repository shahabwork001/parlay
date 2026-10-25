import { LegalDocument } from "./legal-document";

const QUESTIONS = [
  {
    question: "Do I need an account?",
    answer:
      "No. Confirm you are 18 or older, accept the Terms and start chatting. An account lets you subscribe to premium and see the reports you have made.",
  },
  {
    question: "Is anything recorded?",
    answer:
      "No. Video and text are never recorded. If someone reports a conversation, one still image and the last few messages are kept as evidence for a moderator, then deleted when the retention period ends.",
  },
  {
    question: "How does matching work?",
    answer:
      "Add interests and we first look for someone who shares one. If nobody does within a few seconds, you are matched with a random person who speaks your selected language, or anyone if you chose any language.",
  },
  {
    question: "Can the other person see my location or IP address?",
    answer:
      "Parley never shows your IP address. Direct video connections can expose it to the other browser, so turn on relay-only video in Settings to route everything through our servers.",
  },
  {
    question: "Why was I banned?",
    answer:
      "The ban notice shows the reason and how long it lasts. If you think it was a mistake, submit an appeal from that notice.",
  },
  {
    question: "The video does not connect. What can I do?",
    answer:
      "Allow camera and microphone access in your browser, close other apps using the camera, and try another network if yours blocks real-time media. Parley falls back to a relay automatically on restrictive networks.",
  },
  {
    question: "Which browsers are supported?",
    answer: "Current versions of Chrome, Edge, Firefox and Safari on desktop and mobile.",
  },
] as const;

export function FaqContent() {
  return (
    <LegalDocument title="Frequently asked questions">
      <dl className="flex flex-col divide-y">
        {QUESTIONS.map((item) => (
          <div key={item.question} className="flex flex-col gap-2 py-5 first:pt-0">
            <dt className="font-medium">{item.question}</dt>
            <dd className="text-muted-foreground">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </LegalDocument>
  );
}
