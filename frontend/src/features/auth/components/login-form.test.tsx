import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sessionStore } from "@/lib/auth/session-store";
import { ApiError } from "@/lib/http/api-error";
import { authRepository } from "@/repositories/auth-repository";
import { LoginForm } from "./login-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("next=/account"),
}));
vi.mock("@/services/device-identity", () => ({
  getDeviceFingerprint: () => Promise.resolve("fingerprint-0123456789"),
}));

const session = {
  accessToken: "token",
  accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  principal: {
    kind: "user" as const,
    roles: [],
    emailVerified: true,
    mfa: true,
    termsVersion: null,
  },
};

async function fillCredentials() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), "ada@example.com");
  await user.type(screen.getByLabelText("Password"), "correct horse battery");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  return user;
}

describe("LoginForm", () => {
  beforeEach(() => {
    push.mockReset();
    sessionStore.setState({ status: "ready", session: null });
  });

  it("signs in and goes to the requested page", async () => {
    vi.spyOn(authRepository, "login").mockResolvedValueOnce(session);
    render(<LoginForm />);

    await fillCredentials();

    expect(push).toHaveBeenCalledWith("/account");
    expect(sessionStore.getState().session?.accessToken).toBe("token");
  });

  it("asks for a second factor when the account requires it", async () => {
    const login = vi
      .spyOn(authRepository, "login")
      .mockRejectedValueOnce(
        new ApiError(401, {
          status: 401,
          errorCode: "auth.two_factor_required",
          detail: "Enter the code",
        }),
      )
      .mockResolvedValueOnce(session);
    render(<LoginForm />);

    const user = await fillCredentials();
    await user.type(await screen.findByLabelText("Authentication code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    expect(login).toHaveBeenLastCalledWith(
      expect.objectContaining({ email: "ada@example.com", totpCode: "123456" }),
    );
    expect(push).toHaveBeenCalled();
  });

  it("validates the code format before calling the API", async () => {
    const login = vi
      .spyOn(authRepository, "login")
      .mockRejectedValueOnce(
        new ApiError(401, { status: 401, errorCode: "auth.two_factor_required" }),
      );
    render(<LoginForm />);

    const user = await fillCredentials();
    await user.click(await screen.findByRole("button", { name: "Use a recovery code instead" }));
    await user.type(screen.getByLabelText("Recovery code"), "nope");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    expect(screen.getByText("Enter a recovery code like abcde-12345.")).toBeInTheDocument();
    expect(login).toHaveBeenCalledTimes(1);
  });

  it("shows the server message for wrong credentials", async () => {
    vi.spyOn(authRepository, "login").mockRejectedValueOnce(
      new ApiError(401, {
        status: 401,
        errorCode: "auth.invalid_credentials",
        detail: "Email or password is incorrect.",
      }),
    );
    render(<LoginForm />);

    await fillCredentials();

    expect(await screen.findByText("Email or password is incorrect.")).toBeInTheDocument();
  });
});
