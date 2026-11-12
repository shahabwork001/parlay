import type { RequestHandler } from "express";

const noAuthentication: RequestHandler = (_request, _response, next) => {
  next();
};

/** createApp options that tests rarely care about. */
export const testAppDefaults = {
  trustProxy: "loopback",
  authenticate: noAuthentication,
  features: [],
} as const;
