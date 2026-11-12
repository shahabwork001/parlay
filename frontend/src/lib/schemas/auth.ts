import { z } from "zod";

export const ROLES = ["SuperAdmin", "Admin", "Moderator", "Support"] as const;
export type Role = (typeof ROLES)[number];

export const sessionPrincipalSchema = z.object({
  kind: z.enum(["user", "anonymous"]),
  roles: z.array(z.enum(ROLES)),
  emailVerified: z.boolean(),
  mfa: z.boolean(),
  termsVersion: z.string().nullable(),
});

export const sessionResponseSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.iso.datetime(),
  principal: sessionPrincipalSchema,
});

export const accessTokenResponseSchema = sessionResponseSchema.pick({
  accessToken: true,
  accessTokenExpiresAt: true,
});

export const accountSchema = z.object({
  kind: z.enum(["user", "anonymous"]),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  roles: z.array(z.enum(ROLES)),
  permissions: z.array(z.string()),
  mfa: z.boolean(),
  twoFactorEnabled: z.boolean(),
  termsVersion: z.string().nullable(),
  termsCurrent: z.boolean(),
  currentTermsVersion: z.string(),
});

export const twoFactorSetupSchema = z.object({ secret: z.string(), otpauthUri: z.string() });

export const twoFactorEnabledSchema = z.object({
  recoveryCodes: z.array(z.string()),
  session: sessionResponseSchema,
});

export const acceptedSchema = z.object({ status: z.string() });

export type SessionPrincipal = z.infer<typeof sessionPrincipalSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type Account = z.infer<typeof accountSchema>;
export type TwoFactorSetup = z.infer<typeof twoFactorSetupSchema>;

/** Form schemas mirror the API's rules so errors show before a round trip. */
export const emailField = z.email("Enter a valid email address.").max(254);
export const newPasswordField = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.");
export const totpField = z.string().regex(/^\d{6}$/, "Enter the 6-digit code.");
export const recoveryCodeField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]{5}-[a-z0-9]{5}$/, "Enter a recovery code like abcde-12345.");
