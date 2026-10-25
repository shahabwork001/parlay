import { z } from "zod";
import type { AuthSession } from "../../../application/features/identity/sessions.js";
import type { IssuedToken } from "../../../application/features/identity/ports.js";
import { PERMISSIONS, ROLES } from "../../../domain/identity/roles.js";

/** Response shapes. Defined with zod so the OpenAPI document and the code cannot drift apart. */
export const sessionPrincipalSchema = z
  .object({
    kind: z.enum(["user", "anonymous"]),
    roles: z.array(z.enum(ROLES)),
    emailVerified: z.boolean(),
    mfa: z.boolean(),
    termsVersion: z.string().nullable(),
  })
  .meta({ id: "SessionPrincipal" });

export const sessionResponseSchema = z
  .object({
    accessToken: z.string(),
    accessTokenExpiresAt: z.iso.datetime(),
    principal: sessionPrincipalSchema,
  })
  .meta({ id: "SessionResponse" });

export const accessTokenResponseSchema = z
  .object({ accessToken: z.string(), accessTokenExpiresAt: z.iso.datetime() })
  .meta({ id: "AccessTokenResponse" });

export const accountResponseSchema = z
  .object({
    kind: z.enum(["user", "anonymous"]),
    email: z.email().nullable(),
    emailVerified: z.boolean(),
    roles: z.array(z.enum(ROLES)),
    permissions: z.array(z.enum(PERMISSIONS)),
    mfa: z.boolean(),
    twoFactorEnabled: z.boolean(),
    termsVersion: z.string().nullable(),
    termsCurrent: z.boolean(),
    currentTermsVersion: z.string(),
  })
  .meta({ id: "Account" });

export const twoFactorSetupResponseSchema = z
  .object({ secret: z.string(), otpauthUri: z.string() })
  .meta({ id: "TwoFactorSetup" });

export const twoFactorEnabledResponseSchema = z
  .object({ recoveryCodes: z.array(z.string()), session: sessionResponseSchema })
  .meta({ id: "TwoFactorEnabled" });

export const termsResponseSchema = z.object({ version: z.string() }).meta({ id: "TermsVersion" });

export const toAccessTokenResponse = (token: IssuedToken): z.infer<typeof accessTokenResponseSchema> => ({
  accessToken: token.token,
  accessTokenExpiresAt: token.expiresAt.toISOString(),
});

export const toSessionResponse = (session: AuthSession): z.infer<typeof sessionResponseSchema> => ({
  ...toAccessTokenResponse(session.accessToken),
  principal: {
    kind: session.principal.kind,
    roles: [...session.principal.roles],
    emailVerified: session.principal.emailVerified,
    mfa: session.principal.mfa,
    termsVersion: session.principal.termsVersion,
  },
});
