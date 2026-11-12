import { describe, expect, it } from "vitest";
import { ApiError } from "./api-error";
import { errorCode, errorMessage, fieldErrors } from "./error-messages";

describe("error helpers", () => {
  it("uses the problem detail for expected failures", () => {
    const error = new ApiError(409, {
      detail: "That email is taken.",
      errorCode: "user.email_taken",
    });
    expect(errorMessage(error)).toBe("That email is taken.");
    expect(errorCode(error)).toBe("user.email_taken");
  });

  it("hides server internals for 5xx and explains network failures", () => {
    expect(errorMessage(new ApiError(500, { detail: "stack trace" }))).not.toContain("stack");
    expect(errorMessage(new ApiError(0, {}))).toMatch(/connection/);
    expect(errorMessage(new Error("boom"))).toBe("Something went wrong. Try again.");
  });

  it("keeps specific auth lockout messages but generalises other rate limits", () => {
    expect(
      errorMessage(new ApiError(429, { errorCode: "auth.locked", detail: "Locked for a while." })),
    ).toBe("Locked for a while.");
    expect(errorMessage(new ApiError(429, { errorCode: "rate_limited", detail: "x" }))).toMatch(
      /Too many/,
    );
  });

  it("maps body field errors to form field names", () => {
    const error = new ApiError(400, { errors: { "body.email": ["Enter a valid email address."] } });
    expect(fieldErrors(error)).toEqual({ email: "Enter a valid email address." });
  });
});
