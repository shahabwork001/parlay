import { createHmac } from "node:crypto";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { authenticate } from "../../../src/api/auth/authentication.js";
import { createRtcRouter } from "../../../src/api/features/rtc/rtc-router.js";
import { HmacTurnCredentialProvider } from "../../../src/infrastructure/rtc/turn-credentials.js";
import { createTestIdentity } from "../../support/identity-fakes.js";

const settings = {
  secret: "coturn-shared-secret",
  stunUrls: ["stun:turn.example:3478"],
  turnUrls: ["turn:turn.example:3478?transport=udp"],
  ttlSeconds: 600,
};

describe("HmacTurnCredentialProvider", () => {
  it("issues coturn REST credentials: expiry:user and base64 HMAC-SHA1", () => {
    const provider = new HmacTurnCredentialProvider(settings, () => 1_700_000_000_000);

    const configuration = provider.issue("subject-1");

    expect(configuration.ttlSeconds).toBe(600);
    expect(configuration.iceServers[0]).toEqual({ urls: ["stun:turn.example:3478"] });
    const turn = configuration.iceServers[1]!;
    expect(turn.urls).toEqual(["turn:turn.example:3478?transport=udp"]);
    expect(turn.username).toBe("1700000600:subject-1");
    expect(turn.credential).toBe(
      createHmac("sha1", settings.secret).update("1700000600:subject-1").digest("base64"),
    );
  });

  it("omits STUN when none is configured", () => {
    const provider = new HmacTurnCredentialProvider({ ...settings, stunUrls: [] });
    expect(provider.issue("s").iceServers).toHaveLength(1);
  });
});

describe("GET /rtc/ice-servers", () => {
  function buildApp() {
    const identity = createTestIdentity();
    const app = express();
    app.use(authenticate(identity.accessTokens));
    app.use(createRtcRouter(new HmacTurnCredentialProvider(settings)));
    return { app, identity };
  }

  it("requires a session", async () => {
    expect((await request(buildApp().app).get("/rtc/ice-servers")).status).toBe(401);
  });

  it("returns credentials bound to the caller", async () => {
    const { app, identity } = buildApp();
    const { token } = await identity.accessTokens.issue({
      kind: "anonymous",
      subjectId: "device-42",
      deviceId: "device-42",
      roles: [],
      emailVerified: false,
      mfa: false,
      termsVersion: "2026-10-25",
    });

    const response = await request(app).get("/rtc/ice-servers").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.iceServers[1].username).toMatch(/^\d+:device-42$/);
  });
});
