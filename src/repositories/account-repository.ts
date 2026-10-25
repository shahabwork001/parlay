import { type HttpClient, httpClient } from "@/lib/http";
import { TERMS_VERSION } from "@/lib/legal";
import {
  accessTokenResponseSchema,
  type Account,
  accountSchema,
  twoFactorEnabledSchema,
  type TwoFactorSetup,
  twoFactorSetupSchema,
} from "@/lib/schemas/auth";
import type { z } from "zod";

/** The signed-in account (or anonymous session): profile, terms and two-factor settings. */
export class AccountRepository {
  constructor(private readonly client: HttpClient) {}

  getCurrent(signal?: AbortSignal): Promise<Account> {
    return this.client.request("/api/v1/me", { schema: accountSchema, signal });
  }

  acceptCurrentTerms(): Promise<z.infer<typeof accessTokenResponseSchema>> {
    return this.client.request("/api/v1/me/terms", {
      method: "POST",
      body: { ageConfirmed: true, termsVersion: TERMS_VERSION },
      schema: accessTokenResponseSchema,
    });
  }

  startTwoFactorSetup(): Promise<TwoFactorSetup> {
    return this.client.request("/api/v1/me/two-factor/setup", {
      method: "POST",
      schema: twoFactorSetupSchema,
    });
  }

  confirmTwoFactorSetup(code: string): Promise<z.infer<typeof twoFactorEnabledSchema>> {
    return this.client.request("/api/v1/me/two-factor/confirm", {
      method: "POST",
      body: { code },
      schema: twoFactorEnabledSchema,
    });
  }
}

export const accountRepository = new AccountRepository(httpClient);
