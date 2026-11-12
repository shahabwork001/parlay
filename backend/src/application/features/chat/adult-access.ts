import type { Principal } from "../identity/ports.js";

/** Server-only boundary: implementations must read current, unexpired provider verification.
 * Never trust a client field, age checkbox, JWT claim or image classifier as age assurance.
 */
export interface AdultAccessPolicy {
  isVerifiedAdult(principal: Principal): Promise<boolean>;
}

export const UNAVAILABLE_ADULT_ACCESS: AdultAccessPolicy = {
  isVerifiedAdult: () => Promise.resolve(false),
};

export async function adultAdmission(
  principal: Principal,
  consent: boolean,
  policy: AdultAccessPolicy = UNAVAILABLE_ADULT_ACCESS,
): Promise<{ code: string; message: string } | null> {
  if (!consent)
    return {
      code: "adult.consent_required",
      message: "Explicit consent is required for each Adult Chat search.",
    };
  if (principal.kind !== "user" || !(await policy.isVerifiedAdult(principal)))
    return {
      code: "adult.verification_required",
      message:
        "Adult Chat is unavailable until age verification is configured and your adult status is verified.",
    };
  return null;
}
