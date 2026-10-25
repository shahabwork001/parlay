import { createHmac } from "node:crypto";
import type {
  IceServerConfiguration,
  IceServerProvider,
} from "../../application/features/rtc/ice-servers.js";

export interface TurnSettings {
  /** Shared secret configured in coturn as `static-auth-secret`. */
  readonly secret: string;
  readonly stunUrls: readonly string[];
  readonly turnUrls: readonly string[];
  readonly ttlSeconds: number;
}

/**
 * coturn's TURN REST API (`use-auth-secret`): username = `<expiry unix seconds>:<user id>`,
 * password = base64(HMAC-SHA1(secret, username)). coturn recomputes the HMAC and rejects expired
 * usernames, so the API never has to talk to coturn.
 */
export class HmacTurnCredentialProvider implements IceServerProvider {
  constructor(
    private readonly settings: TurnSettings,
    private readonly now: () => number = Date.now,
  ) {}

  issue(subjectId: string): IceServerConfiguration {
    const expiresAt = Math.floor(this.now() / 1000) + this.settings.ttlSeconds;
    const username = `${expiresAt}:${subjectId}`;
    const credential = createHmac("sha1", this.settings.secret).update(username).digest("base64");

    return {
      iceServers: [
        ...(this.settings.stunUrls.length > 0 ? [{ urls: this.settings.stunUrls }] : []),
        { urls: this.settings.turnUrls, username, credential },
      ],
      ttlSeconds: this.settings.ttlSeconds,
    };
  }
}
