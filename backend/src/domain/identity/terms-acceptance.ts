/**
 * Proof that someone confirmed they are 18+ and accepted a specific version of the Terms and
 * Community Guidelines. Parley is strictly adults only, so acceptance without the age
 * confirmation is impossible to construct.
 */
export interface TermsAcceptance {
  readonly version: string;
  readonly acceptedAt: Date;
  readonly ageConfirmed: true;
}

export const acceptTerms = (version: string, now: Date): TermsAcceptance => ({
  version,
  acceptedAt: now,
  ageConfirmed: true,
});

export const isCurrentAcceptance = (acceptance: TermsAcceptance | null, currentVersion: string): boolean =>
  acceptance?.version === currentVersion;
