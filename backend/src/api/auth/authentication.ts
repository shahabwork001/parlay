import type { RequestHandler, Response } from "express";
import type { AccessTokenService, Principal } from "../../application/features/identity/ports.js";
import { type Permission, permissionsFor } from "../../domain/identity/roles.js";
import { sendProblem } from "../http/problem-details.js";

declare module "express-serve-static-core" {
  interface Locals {
    principal?: Principal;
  }
}

const BEARER = /^Bearer ([A-Za-z0-9._-]+)$/;

/** Verifies a Bearer access token when present and exposes the caller as `res.locals.principal`. */
export function authenticate(accessTokens: AccessTokenService): RequestHandler {
  return async (request, response, next) => {
    const match = BEARER.exec(request.headers.authorization ?? "");
    if (match?.[1]) {
      const principal = await accessTokens.verify(match[1]);
      if (principal) response.locals.principal = principal;
    }
    next();
  };
}

export const currentPrincipal = (response: Response): Principal => {
  const principal = response.locals.principal;
  if (!principal) throw new Error("currentPrincipal used on a route without requireAuthentication.");
  return principal;
};

export const requireAuthentication: RequestHandler = (request, response, next) => {
  if (response.locals.principal) {
    next();
    return;
  }
  response.set("WWW-Authenticate", 'Bearer realm="parley"');
  sendProblem(request, response, {
    status: 401,
    detail: "Sign in or start a session to continue.",
    errorCode: "auth.required",
  });
};

/**
 * Staff authorization. Requires an account whose roles grant the permission, on a session that
 * passed two-factor authentication (mandatory for staff).
 */
export function requirePermission(permission: Permission): RequestHandler[] {
  return [
    requireAuthentication,
    (request, response, next) => {
      const principal = currentPrincipal(response);
      if (!permissionsFor(principal.roles).has(permission)) {
        sendProblem(request, response, {
          status: 403,
          detail: "You do not have permission to do this.",
          errorCode: "auth.forbidden",
        });
        return;
      }
      if (!principal.mfa) {
        sendProblem(request, response, {
          status: 403,
          detail: "Staff access requires two-factor authentication.",
          errorCode: "auth.mfa_required",
        });
        return;
      }
      next();
    },
  ];
}
