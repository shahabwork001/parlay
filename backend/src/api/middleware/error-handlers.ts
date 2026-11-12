import type { ErrorRequestHandler, RequestHandler } from "express";
import { sendProblem } from "../http/problem-details.js";

export const notFoundHandler: RequestHandler = (request, response) => {
  sendProblem(request, response, { status: 404, detail: "No resource matches this path." });
};

const isHttpError = (error: unknown): error is { status: number; expose?: boolean; message: string } =>
  typeof error === "object" &&
  error !== null &&
  "status" in error &&
  typeof error.status === "number" &&
  error.status >= 400 &&
  error.status < 500;

/** Turns thrown errors into RFC 7807 responses without leaking internals to clients. */
export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (isHttpError(error)) {
    sendProblem(request, response, {
      status: error.status,
      detail: error.expose ? error.message : "The request could not be processed.",
    });
    return;
  }

  request.log.error({ err: error }, "Unhandled error");
  sendProblem(request, response, { status: 500 });
};
