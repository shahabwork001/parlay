const RULES = [
  "Adults only. You must be 18 or older to use Parley.",
  "No nudity, sexual content or sexual requests.",
  "No harassment, hate speech, threats or violence.",
  "No spam, advertising or sharing personal contact details.",
  "Skip anyone, any time. Report anything that breaks these rules.",
] as const;

export function GroundRules() {
  return (
    <section aria-labelledby="ground-rules-heading" className="flex flex-col gap-4">
      <h2 id="ground-rules-heading" className="text-sm font-medium">
        Ground rules
      </h2>
      <ol className="flex flex-col gap-3 text-sm text-muted-foreground">
        {RULES.map((rule, index) => (
          <li key={rule} className="flex gap-3">
            <span className="w-4 shrink-0 text-right font-mono text-xs leading-5 text-foreground/60">
              {index + 1}
            </span>
            <span>{rule}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
