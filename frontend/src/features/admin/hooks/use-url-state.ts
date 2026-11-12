"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

/**
 * Filter, sort and page state kept in the query string, so admin views survive reloads and can be
 * shared as links. Values equal to their default are left out of the URL. Pass a module-level
 * constant as `defaults` so its identity is stable.
 */
export function useUrlState<T extends Record<string, string>>(
  defaults: T,
): [T, (patch: Partial<T>) => void] {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const values = useMemo(() => {
    const result: Record<string, string> = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const value = params.get(key);
      if (value) result[key] = value;
    }
    return result as T;
  }, [params, defaults]);

  const update = useCallback(
    (patch: Partial<T>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "" || value === defaults[key]) next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router, defaults],
  );

  return [values, update];
}

/** A page number from the URL (1 when missing or invalid). */
export const pageFrom = (value: string): number => Math.max(1, Number.parseInt(value, 10) || 1);
