import type { OpenAPIRegistry, RouteConfig } from "@asteasolutions/zod-to-openapi";
import type { z } from "zod";
import {
  acceptTermsRequestSchema,
  anonymousSessionRequestSchema,
  confirmTwoFactorRequestSchema,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
  tokenRequestSchema,
} from "../../../application/features/identity/schemas.js";
import { problemDetailsSchema } from "../../openapi/common-schemas.js";
import {
  accessTokenResponseSchema,
  accountResponseSchema,
  sessionResponseSchema,
  termsResponseSchema,
  twoFactorEnabledResponseSchema,
  twoFactorSetupResponseSchema,
} from "./identity-contract.js";

const json = (schema: z.ZodType) => ({ content: { "application/json": { schema } } });
const problem = (description: string) => ({
  description,
  content: { "application/problem+json": { schema: problemDetailsSchema } },
});
const bearer = [{ bearerAuth: [] }];
const sessionCookie = "Sets the `parley_refresh` httpOnly cookie (path `/api/v1/auth`).";

type Path = Omit<RouteConfig, "method" | "path" | "tags">;

const routes: [RouteConfig["method"], string, Path][] = [
  [
    "get",
    "/api/v1/legal/terms",
    {
      summary: "Current Terms and Community Guidelines version",
      responses: { 200: { description: "Version", ...json(termsResponseSchema) } },
    },
  ],
  [
    "post",
    "/api/v1/auth/anonymous",
    {
      summary: "Start an anonymous device session (18+ and Terms gate)",
      description: sessionCookie,
      request: { body: json(anonymousSessionRequestSchema) },
      responses: {
        200: { description: "Session started", ...json(sessionResponseSchema) },
        400: problem("Validation failed or Terms outdated (`terms.outdated`)"),
        429: problem("Rate limited"),
      },
    },
  ],
  [
    "post",
    "/api/v1/auth/register",
    {
      summary: "Register an account",
      description: "Always 202, whether or not the email is taken, so accounts cannot be enumerated.",
      request: { body: json(registerRequestSchema) },
      responses: {
        202: { description: "Verification email sent" },
        400: problem("Validation failed"),
        429: problem("Rate limited"),
      },
    },
  ],
  [
    "post",
    "/api/v1/auth/verify-email",
    {
      summary: "Confirm an email address",
      request: { body: json(tokenRequestSchema) },
      responses: {
        204: { description: "Verified" },
        400: problem("Invalid or expired token (`auth.invalid_token`)"),
      },
    },
  ],
  [
    "post",
    "/api/v1/auth/resend-verification",
    {
      summary: "Send the verification email again",
      security: bearer,
      responses: {
        202: { description: "Sent if the email is not yet verified" },
        401: problem("Not signed in"),
      },
    },
  ],
  [
    "post",
    "/api/v1/auth/login",
    {
      summary: "Sign in with email and password",
      description: `${sessionCookie} Accounts with two-factor authentication need \`totpCode\` or \`recoveryCode\`.`,
      request: { body: json(loginRequestSchema) },
      responses: {
        200: { description: "Signed in", ...json(sessionResponseSchema) },
        401: problem("`auth.invalid_credentials`, `auth.two_factor_required` or `auth.invalid_two_factor`"),
        403: problem("`auth.email_not_verified`"),
        429: problem("`auth.locked` after repeated failures, or rate limited"),
      },
    },
  ],
  [
    "post",
    "/api/v1/auth/refresh",
    {
      summary: "Rotate the refresh cookie and get a new access token",
      description: "Reusing an old refresh token revokes the whole session family.",
      responses: {
        200: { description: "Refreshed", ...json(sessionResponseSchema) },
        401: problem("`auth.session_expired`"),
      },
    },
  ],
  [
    "post",
    "/api/v1/auth/logout",
    { summary: "Sign out this session", responses: { 204: { description: "Signed out" } } },
  ],
  [
    "post",
    "/api/v1/auth/password/forgot",
    {
      summary: "Request a password reset email",
      description: "Always 202 so accounts cannot be enumerated.",
      request: { body: json(forgotPasswordRequestSchema) },
      responses: { 202: { description: "Sent if the account exists" } },
    },
  ],
  [
    "post",
    "/api/v1/auth/password/reset",
    {
      summary: "Set a new password with a reset token",
      description: "Signs the account out of every session.",
      request: { body: json(resetPasswordRequestSchema) },
      responses: { 204: { description: "Password changed" }, 400: problem("Invalid or expired token") },
    },
  ],
  [
    "get",
    "/api/v1/me",
    {
      summary: "The current account or anonymous session",
      security: bearer,
      responses: {
        200: { description: "Account", ...json(accountResponseSchema) },
        401: problem("Not signed in"),
      },
    },
  ],
  [
    "post",
    "/api/v1/me/terms",
    {
      summary: "Accept the current Terms",
      security: bearer,
      request: { body: json(acceptTermsRequestSchema) },
      responses: {
        200: { description: "New access token", ...json(accessTokenResponseSchema) },
        400: problem("Outdated version"),
      },
    },
  ],
  [
    "post",
    "/api/v1/me/two-factor/setup",
    {
      summary: "Start TOTP enrolment",
      security: bearer,
      responses: {
        200: { description: "Secret and otpauth URI", ...json(twoFactorSetupResponseSchema) },
        409: problem("Already enabled"),
      },
    },
  ],
  [
    "post",
    "/api/v1/me/two-factor/confirm",
    {
      summary: "Confirm TOTP enrolment",
      description: `Returns single-use recovery codes and a new multi-factor session. ${sessionCookie}`,
      security: bearer,
      request: { body: json(confirmTwoFactorRequestSchema) },
      responses: {
        200: { description: "Enabled", ...json(twoFactorEnabledResponseSchema) },
        401: problem("Invalid code"),
      },
    },
  ],
];

export function registerIdentityOpenApi(registry: OpenAPIRegistry): void {
  for (const [method, path, config] of routes) {
    registry.registerPath({
      method,
      path,
      tags: [path.startsWith("/api/v1/me") ? "Account" : "Auth"],
      ...config,
    });
  }
}
