import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { z } from "zod";
import { sendProblem } from "../http/problem-details.js";

interface RequestSchemas<TBody, TQuery, TParams> {
  body?: z.ZodType<TBody>;
  query?: z.ZodType<TQuery>;
  params?: z.ZodType<TParams>;
}

export interface Validated<TBody, TQuery, TParams> {
  body: TBody;
  query: TQuery;
  params: TParams;
}

declare module "express-serve-static-core" {
  interface Locals {
    validated?: Validated<unknown, unknown, unknown>;
  }
}

/**
 * Validates body, query and params with zod. On failure responds 400 with field errors; on
 * success stores parsed values in `res.locals.validated` (read them with `validatedInput`).
 */
export function validate<TBody = undefined, TQuery = undefined, TParams = undefined>(
  schemas: RequestSchemas<TBody, TQuery, TParams>,
): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    const errors: Record<string, string[]> = {};
    const parsePart = <T>(
      part: "body" | "query" | "params",
      schema: z.ZodType<T> | undefined,
    ): T | undefined => {
      if (!schema) return undefined;
      const result = schema.safeParse(request[part]);
      if (result.success) return result.data;
      for (const issue of result.error.issues) {
        const key = [part, ...issue.path.map(String)].join(".");
        (errors[key] ??= []).push(issue.message);
      }
      return undefined;
    };

    const validated = {
      body: parsePart("body", schemas.body),
      query: parsePart("query", schemas.query),
      params: parsePart("params", schemas.params),
    };

    if (Object.keys(errors).length > 0) {
      sendProblem(request, response, { status: 400, detail: "One or more fields are invalid.", errors });
      return;
    }

    response.locals.validated = validated;
    next();
  };
}

export function validatedInput<TBody = undefined, TQuery = undefined, TParams = undefined>(
  response: Response,
): Validated<TBody, TQuery, TParams> {
  const validated = response.locals.validated;
  if (!validated) throw new Error("validatedInput called on a route without the validate middleware.");
  return validated as Validated<TBody, TQuery, TParams>;
}
