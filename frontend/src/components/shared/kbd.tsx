import type { ReactNode } from "react";

/** A subtle keyboard-shortcut hint, hidden on touch-sized screens where there is no keyboard. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="ml-1 hidden rounded border bg-muted px-1 font-mono text-[10px] leading-4 font-normal text-muted-foreground sm:inline">
      {children}
    </kbd>
  );
}
