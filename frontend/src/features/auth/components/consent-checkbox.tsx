"use client";

import { type ReactNode, useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";

interface ConsentCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: true | undefined) => void;
  error?: string | undefined;
  children: ReactNode;
}

/** A required consent checkbox. Unchecked maps to `undefined` so zod literal(true) reports it. */
export function ConsentCheckbox({
  checked,
  onCheckedChange,
  error,
  children,
}: ConsentCheckboxProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true ? true : undefined)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5"
        />
        <label htmlFor={id} className="text-sm leading-relaxed">
          {children}
        </label>
      </div>
      {error ? (
        <p id={errorId} className="pl-7 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
