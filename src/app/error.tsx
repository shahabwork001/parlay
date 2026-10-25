"use client";

import { Button } from "@/components/ui/button";

export default function RouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="main"
      role="alert"
      className="mx-auto flex w-full max-w-md flex-1 flex-col items-start justify-center gap-4 px-4 py-24"
    >
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong.</h1>
      <p className="text-sm text-muted-foreground">
        An unexpected error occurred. Try again, and if it keeps happening, check the status page.
      </p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
