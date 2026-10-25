import type { Request, Response } from "express";
import type { AppError, ErrorType } from "../../domain/common/app-error.js";

/** RFC 7807 body. `errorCode` identifies expected failures; `errors` carries field validation messages. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  traceId?: string;
  errorCode?: string;
  errors?: Record<string, string[]>;
}

const STATUS_BY_ERROR_TYPE: Record<ErrorType, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  failure: 422,
  rate_limited: 429,
};

const TITLES: Record<number, string> = {
  400: "Validation failed",
  401: "Authentication required",
  403: "Forbidden",
  404: "Not found",
  409: "Conflict",
  413: "Payload too large",
  422: "Request could not be completed",
  429: "Too many requests",
  500: "An unexpected error occurred",
};

export const statusForErrorType = (type: ErrorType): number => STATUS_BY_ERROR_TYPE[type];

export function sendProblem(
  request: Request,
  response: Response,
  problem: Omit<ProblemDetails, "type" | "title" | "instance" | "traceId"> & { title?: string },
): void {
  const body: ProblemDetails = {
    type: `https://httpstatuses.io/${problem.status}`,
    title: problem.title ?? TITLES[problem.status] ?? "Error",
    instance: request.originalUrl,
    traceId: typeof request.id === "string" ? request.id : undefined,
    ...problem,
  };
  response.status(problem.status).type("application/problem+json").json(body);
}

export function sendAppError(request: Request, response: Response, error: AppError): void {
  sendProblem(request, response, {
    status: statusForErrorType(error.type),
    detail: error.message,
    errorCode: error.code,
  });
}
