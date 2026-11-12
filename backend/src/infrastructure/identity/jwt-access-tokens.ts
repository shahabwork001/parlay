import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import type {
  AccessTokenService,
  IssuedToken,
  Principal,
} from "../../application/features/identity/ports.js";
import { ROLES } from "../../domain/identity/roles.js";

export interface AccessTokenSettings {
  readonly secret: string;
  readonly issuer: string;
  readonly audience: string;
  readonly ttlSeconds: number;
}

const claimsSchema = z.object({
  sub: z.string().min(1),
  knd: z.enum(["user", "anonymous"]),
  dev: z.string().min(1),
  rol: z.array(z.enum(ROLES)),
  ev: z.boolean(),
  mfa: z.boolean(),
  tv: z.string().nullable(),
});

/** Short-lived HS256 JWTs. Claims are compact and re-validated with zod on every verification. */
export class JwtAccessTokenService implements AccessTokenService {
  readonly #key: Uint8Array;

  constructor(private readonly settings: AccessTokenSettings) {
    this.#key = new TextEncoder().encode(settings.secret);
  }

  async issue(principal: Principal): Promise<IssuedToken> {
    const expiresAt = new Date(Date.now() + this.settings.ttlSeconds * 1000);
    const token = await new SignJWT({
      knd: principal.kind,
      dev: principal.deviceId,
      rol: [...principal.roles],
      ev: principal.emailVerified,
      mfa: principal.mfa,
      tv: principal.termsVersion,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(principal.subjectId)
      .setIssuer(this.settings.issuer)
      .setAudience(this.settings.audience)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.#key);
    return { token, expiresAt };
  }

  async verify(token: string): Promise<Principal | null> {
    try {
      const { payload } = await jwtVerify(token, this.#key, {
        issuer: this.settings.issuer,
        audience: this.settings.audience,
        algorithms: ["HS256"],
      });
      const claims = claimsSchema.parse(payload);
      return {
        kind: claims.knd,
        subjectId: claims.sub,
        deviceId: claims.dev,
        roles: claims.rol,
        emailVerified: claims.ev,
        mfa: claims.mfa,
        termsVersion: claims.tv,
      };
    } catch {
      return null;
    }
  }
}
