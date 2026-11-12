import type { ReactNode } from "react";

interface LegalDocumentProps {
  title: string;
  updated?: string;
  intro?: ReactNode;
  children: ReactNode;
}

/** Long-form reading layout shared by the legal and help pages: one measure, quiet hierarchy. */
export function LegalDocument({ title, updated, intro, children }: LegalDocumentProps) {
  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-3 border-b pb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {updated ? <p className="text-sm text-muted-foreground">Effective {updated}</p> : null}
        {intro ? (
          <div className="text-base leading-relaxed text-muted-foreground">{intro}</div>
        ) : null}
      </header>
      <div className="flex flex-col gap-4 pt-8 text-[15px] leading-7 [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-2 [&_h3]:font-medium [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_strong]:font-medium [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}
