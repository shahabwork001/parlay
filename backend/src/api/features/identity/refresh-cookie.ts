import type { CookieOptions, Request, Response } from "express";

export const REFRESH_COOKIE = "parley_refresh";

/** Scoped to the auth routes so the refresh token is never sent with any other request. */
const COOKIE_PATH = "/api/v1/auth";

const options = (secure: boolean, expires?: Date): CookieOptions => ({
  httpOnly: true,
  secure,
  sameSite: "strict",
  path: COOKIE_PATH,
  ...(expires ? { expires } : {}),
});

export function setRefreshCookie(response: Response, token: string, expiresAt: Date, secure: boolean): void {
  response.cookie(REFRESH_COOKIE, token, options(secure, expiresAt));
}

export function clearRefreshCookie(response: Response, secure: boolean): void {
  response.clearCookie(REFRESH_COOKIE, options(secure));
}

export function readRefreshCookie(request: Request): string | undefined {
  const value: unknown = (request.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
