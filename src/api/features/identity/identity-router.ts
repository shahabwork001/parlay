import { type Response, Router } from "express";
import {
  ResendVerification,
  RegisterUser,
  RequestPasswordReset,
  ResetPassword,
  VerifyEmail,
} from "../../../application/features/identity/accounts.js";
import {
  AcceptCurrentTerms,
  ConfirmTwoFactorSetup,
  GetCurrentAccount,
  StartTwoFactorSetup,
} from "../../../application/features/identity/account-settings.js";
import { CreateAnonymousSession } from "../../../application/features/identity/anonymous-session.js";
import type { IdentityContext } from "../../../application/features/identity/identity-context.js";
import { Login } from "../../../application/features/identity/login.js";
import { Logout, RefreshAuthSession } from "../../../application/features/identity/refresh.js";
import {
  acceptTermsRequestSchema,
  anonymousSessionRequestSchema,
  confirmTwoFactorRequestSchema,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
  tokenRequestSchema,
  type AcceptTermsRequest,
  type AnonymousSessionRequest,
  type LoginRequest,
  type RegisterRequest,
  type ResetPasswordRequest,
} from "../../../application/features/identity/schemas.js";
import type { AuthSession } from "../../../application/features/identity/sessions.js";
import type { RateLimiter } from "../../../application/abstractions/rate-limiter.js";
import { currentPrincipal, requireAuthentication } from "../../auth/authentication.js";
import { sendAppError, sendProblem } from "../../http/problem-details.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { validate, validatedInput } from "../../middleware/validate.js";
import { toAccessTokenResponse, toSessionResponse } from "./identity-contract.js";
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from "./refresh-cookie.js";

export interface IdentityRouterDependencies {
  readonly context: IdentityContext;
  readonly rateLimiter: RateLimiter;
  readonly cookieSecure: boolean;
  readonly rateLimitMultiplier: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export function createIdentityRouter({
  context,
  rateLimiter,
  cookieSecure,
  rateLimitMultiplier,
}: IdentityRouterDependencies): Router {
  const router = Router();
  const limit = (name: string, maxRequests: number, windowMs: number) =>
    rateLimit(
      { limiter: rateLimiter, hasher: context.hasher },
      { name, limit: maxRequests * rateLimitMultiplier, windowMs },
    );

  const sendSession = (response: Response, session: AuthSession) => {
    setRefreshCookie(response, session.refreshToken.token, session.refreshToken.expiresAt, cookieSecure);
    response.set("Cache-Control", "no-store").json(toSessionResponse(session));
  };

  const createAnonymousSession = new CreateAnonymousSession(context);
  const registerUser = new RegisterUser(context);
  const verifyEmail = new VerifyEmail(context);
  const resendVerification = new ResendVerification(context);
  const login = new Login(context);
  const refresh = new RefreshAuthSession(context);
  const logout = new Logout(context);
  const requestPasswordReset = new RequestPasswordReset(context);
  const resetPassword = new ResetPassword(context);
  const getCurrentAccount = new GetCurrentAccount(context);
  const acceptTerms = new AcceptCurrentTerms(context);
  const startTwoFactor = new StartTwoFactorSetup(context);
  const confirmTwoFactor = new ConfirmTwoFactorSetup(context);

  router.get("/legal/terms", (_request, response) => {
    response.set("Cache-Control", "public, max-age=300").json({ version: context.settings.termsVersion });
  });

  router.post(
    "/auth/anonymous",
    limit("auth.anonymous", 30, HOUR),
    validate({ body: anonymousSessionRequestSchema }),
    async (request, response) => {
      const result = await createAnonymousSession.execute(
        validatedInput<AnonymousSessionRequest>(response).body,
      );
      if (!result.ok) {
        sendAppError(request, response, result.error);
        return;
      }
      sendSession(response, result.value);
    },
  );

  router.post(
    "/auth/register",
    limit("auth.register", 5, HOUR),
    validate({ body: registerRequestSchema }),
    async (request, response) => {
      const result = await registerUser.execute(validatedInput<RegisterRequest>(response).body);
      if (!result.ok) {
        sendAppError(request, response, result.error);
        return;
      }
      response.status(202).json({ status: "verification_sent" });
    },
  );

  router.post(
    "/auth/verify-email",
    limit("auth.verify", 20, HOUR),
    validate({ body: tokenRequestSchema }),
    async (request, response) => {
      const result = await verifyEmail.execute(validatedInput<{ token: string }>(response).body.token);
      if (!result.ok) {
        sendAppError(request, response, result.error);
        return;
      }
      response.status(204).end();
    },
  );

  router.post(
    "/auth/resend-verification",
    requireAuthentication,
    limit("auth.resend", 5, HOUR),
    async (request, response) => {
      const result = await resendVerification.execute(currentPrincipal(response));
      if (!result.ok) {
        sendAppError(request, response, result.error);
        return;
      }
      response.status(202).json({ status: "verification_sent" });
    },
  );

  router.post(
    "/auth/login",
    limit("auth.login", 10, MINUTE),
    validate({ body: loginRequestSchema }),
    async (request, response) => {
      const result = await login.execute(validatedInput<LoginRequest>(response).body);
      if (!result.ok) {
        sendAppError(request, response, result.error);
        return;
      }
      sendSession(response, result.value);
    },
  );

  router.post("/auth/refresh", limit("auth.refresh", 60, MINUTE), async (request, response) => {
    const token = readRefreshCookie(request);
    const result = token ? await refresh.execute(token) : null;
    if (!result?.ok) {
      clearRefreshCookie(response, cookieSecure);
      sendProblem(request, response, {
        status: 401,
        detail: "Your session has expired. Sign in again.",
        errorCode: "auth.session_expired",
      });
      return;
    }
    sendSession(response, result.value);
  });

  router.post("/auth/logout", async (request, response) => {
    await logout.execute(readRefreshCookie(request));
    clearRefreshCookie(response, cookieSecure);
    response.status(204).end();
  });

  router.post(
    "/auth/password/forgot",
    limit("auth.forgot", 5, HOUR),
    validate({ body: forgotPasswordRequestSchema }),
    async (_request, response) => {
      await requestPasswordReset.execute(validatedInput<{ email: string }>(response).body.email);
      response.status(202).json({ status: "reset_sent_if_account_exists" });
    },
  );

  router.post(
    "/auth/password/reset",
    limit("auth.reset", 10, HOUR),
    validate({ body: resetPasswordRequestSchema }),
    async (request, response) => {
      const result = await resetPassword.execute(validatedInput<ResetPasswordRequest>(response).body);
      if (!result.ok) {
        sendAppError(request, response, result.error);
        return;
      }
      response.status(204).end();
    },
  );

  router.get("/me", requireAuthentication, async (request, response) => {
    const result = await getCurrentAccount.execute(currentPrincipal(response));
    if (!result.ok) {
      sendAppError(request, response, result.error);
      return;
    }
    response.set("Cache-Control", "no-store").json(result.value);
  });

  router.post(
    "/me/terms",
    requireAuthentication,
    validate({ body: acceptTermsRequestSchema }),
    async (request, response) => {
      const result = await acceptTerms.execute(
        currentPrincipal(response),
        validatedInput<AcceptTermsRequest>(response).body,
      );
      if (!result.ok) {
        sendAppError(request, response, result.error);
        return;
      }
      response.json(toAccessTokenResponse(result.value));
    },
  );

  router.post("/me/two-factor/setup", requireAuthentication, async (request, response) => {
    const result = await startTwoFactor.execute(currentPrincipal(response));
    if (!result.ok) {
      sendAppError(request, response, result.error);
      return;
    }
    response.set("Cache-Control", "no-store").json(result.value);
  });

  router.post(
    "/me/two-factor/confirm",
    requireAuthentication,
    limit("auth.two-factor", 10, 5 * MINUTE),
    validate({ body: confirmTwoFactorRequestSchema }),
    async (request, response) => {
      const result = await confirmTwoFactor.execute(
        currentPrincipal(response),
        validatedInput<{ code: string }>(response).body.code,
      );
      if (!result.ok) {
        sendAppError(request, response, result.error);
        return;
      }
      const { recoveryCodes, session } = result.value;
      setRefreshCookie(response, session.refreshToken.token, session.refreshToken.expiresAt, cookieSecure);
      response.set("Cache-Control", "no-store").json({ recoveryCodes, session: toSessionResponse(session) });
    },
  );

  return router;
}
