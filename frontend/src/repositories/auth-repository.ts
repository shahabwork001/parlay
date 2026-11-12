import { type HttpClient, httpClient } from "@/lib/http";
import { TERMS_VERSION } from "@/lib/legal";
import { acceptedSchema, type SessionResponse, sessionResponseSchema } from "@/lib/schemas/auth";
import { z } from "zod";

const noContent = z.undefined();

export interface LoginInput {
  email: string;
  password: string;
  deviceFingerprint: string;
  totpCode?: string;
  recoveryCode?: string;
}

/** Authentication endpoints. Successful sign-ins also set the httpOnly refresh cookie. */
export class AuthRepository {
  constructor(private readonly client: HttpClient) {}

  startAnonymousSession(deviceFingerprint: string): Promise<SessionResponse> {
    return this.client.request("/api/v1/auth/anonymous", {
      method: "POST",
      body: { deviceFingerprint, ageConfirmed: true, termsVersion: TERMS_VERSION },
      schema: sessionResponseSchema,
    });
  }

  async register(email: string, password: string): Promise<void> {
    await this.client.request("/api/v1/auth/register", {
      method: "POST",
      body: { email, password, ageConfirmed: true, termsVersion: TERMS_VERSION },
      schema: acceptedSchema,
    });
  }

  async verifyEmail(token: string): Promise<void> {
    await this.client.request("/api/v1/auth/verify-email", {
      method: "POST",
      body: { token },
      schema: noContent,
    });
  }

  async resendVerification(): Promise<void> {
    await this.client.request("/api/v1/auth/resend-verification", {
      method: "POST",
      schema: acceptedSchema,
    });
  }

  login(input: LoginInput): Promise<SessionResponse> {
    return this.client.request("/api/v1/auth/login", {
      method: "POST",
      body: input,
      schema: sessionResponseSchema,
    });
  }

  async logout(): Promise<void> {
    await this.client.request("/api/v1/auth/logout", { method: "POST", schema: noContent });
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.client.request("/api/v1/auth/password/forgot", {
      method: "POST",
      body: { email },
      schema: acceptedSchema,
    });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await this.client.request("/api/v1/auth/password/reset", {
      method: "POST",
      body: { token, password },
      schema: noContent,
    });
  }
}

export const authRepository = new AuthRepository(httpClient);
