import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { sendAppError, statusForErrorType } from "../../../src/api/http/problem-details.js";
import { validate, validatedInput } from "../../../src/api/middleware/validate.js";
import { AppErrors, type ErrorType } from "../../../src/domain/common/app-error.js";

const body = z.object({ name: z.string().min(2), age: z.number().int().min(18) });
const query = z.object({ page: z.coerce.number().int().min(1).default(1) });

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post("/people", validate({ body, query }), (_request, response) => {
    const input = validatedInput<z.infer<typeof body>, z.infer<typeof query>>(response);
    response.json(input);
  });
  app.get("/conflict", (req, res) => {
    sendAppError(req, res, AppErrors.conflict("person.exists", "That person already exists."));
  });
  return app;
}

describe("validate middleware", () => {
  it("passes parsed, typed values to the handler", async () => {
    const response = await request(buildApp()).post("/people?page=2").send({ name: "Ada", age: 36 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ body: { name: "Ada", age: 36 }, query: { page: 2 } });
  });

  it("rejects invalid input with field-level problem details", async () => {
    const response = await request(buildApp()).post("/people?page=0").send({ name: "A", age: 12 });

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(Object.keys(response.body.errors)).toEqual(["body.name", "body.age", "query.page"]);
  });
});

describe("problem details for expected failures", () => {
  it.each([
    ["validation", 400],
    ["unauthorized", 401],
    ["forbidden", 403],
    ["not_found", 404],
    ["conflict", 409],
    ["failure", 422],
    ["rate_limited", 429],
  ] as [ErrorType, number][])("maps %s to %s", (type, status) => {
    expect(statusForErrorType(type)).toBe(status);
  });

  it("includes the error code and message", async () => {
    const response = await request(buildApp()).get("/conflict");

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      title: "Conflict",
      detail: "That person already exists.",
      errorCode: "person.exists",
    });
  });
});
