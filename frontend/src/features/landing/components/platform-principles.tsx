const PRINCIPLES = [
  {
    title: "Moderated",
    body: "Automated screening runs on every stream, and every report is reviewed by a person.",
  },
  {
    title: "Private by design",
    body: "Video and conversations are never recorded. Your IP address is never shown to anyone.",
  },
  {
    title: "Stays connected",
    body: "Relay servers and automatic reconnection keep calls stable on restrictive networks.",
  },
] as const;

export function PlatformPrinciples() {
  return (
    <section aria-label="How Parley works" className="grid gap-6 border-t pt-10 sm:grid-cols-3">
      {PRINCIPLES.map((principle) => (
        <div key={principle.title} className="flex flex-col gap-1.5">
          <h3 className="text-sm font-medium">{principle.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{principle.body}</p>
        </div>
      ))}
    </section>
  );
}
