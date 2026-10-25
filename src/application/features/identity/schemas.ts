import { z } from "zod";

/** Request schemas shared by the HTTP layer (validation) and the OpenAPI document. */
export const deviceFingerprintSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{16,128}$/, "Invalid device fingerprint.");

export const emailSchema = z.email("Enter a valid email address.").max(254);

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.");

const termsAcceptanceFields = {
  ageConfirmed: z.literal(true, { error: "You must confirm you are 18 or older." }),
  termsVersion: z.string().min(1).max(32),
};

export const anonymousSessionRequestSchema = z.object({
  deviceFingerprint: deviceFingerprintSchema,
  ...termsAcceptanceFields,
});

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  ...termsAcceptanceFields,
});

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  deviceFingerprint: deviceFingerprintSchema,
  totpCode: z
    .string()
    .regex(/^\d{6}$/, "Enter the 6-digit code.")
    .optional(),
  recoveryCode: z
    .string()
    .regex(/^[a-z0-9]{5}-[a-z0-9]{5}$/, "Enter a recovery code like abcde-12345.")
    .optional(),
});

export const tokenRequestSchema = z.object({ token: z.string().min(20).max(200) });

export const forgotPasswordRequestSchema = z.object({ email: emailSchema });

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const acceptTermsRequestSchema = z.object(termsAcceptanceFields);

export const confirmTwoFactorRequestSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export type AnonymousSessionRequest = z.infer<typeof anonymousSessionRequestSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
export type AcceptTermsRequest = z.infer<typeof acceptTermsRequestSchema>;
