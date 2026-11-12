import { describe, expect, it } from "vitest";
import { turnTcpEndpoint } from "../../../src/infrastructure/health/remote-health-checks.js";
import {
  type HealthCheck,
  type HealthStatus,
  runHealthChecks,
} from "../../../src/infrastructure/health/health-check.js";

const check = (name: string, status: HealthStatus): HealthCheck => ({
  name,
  check: () => Promise.resolve({ status }),
});

describe("runHealthChecks", () => {
  it("is healthy when every check is healthy", async () => {
    const report = await runHealthChecks([check("a", "Healthy"), check("b", "Healthy")]);
    expect(report.status).toBe("Healthy");
    expect(report.entries.map((entry) => entry.name)).toEqual(["a", "b"]);
  });

  it("reports the worst individual status", async () => {
    expect((await runHealthChecks([check("a", "Healthy"), check("b", "Degraded")])).status).toBe("Degraded");
    expect((await runHealthChecks([check("a", "Degraded"), check("b", "Unhealthy")])).status).toBe(
      "Unhealthy",
    );
  });

  it("treats a throwing check as unhealthy", async () => {
    const failing: HealthCheck = { name: "db", check: () => Promise.reject(new Error("connection refused")) };

    const report = await runHealthChecks([failing]);

    expect(report.status).toBe("Unhealthy");
    expect(report.entries[0]).toMatchObject({
      name: "db",
      status: "Unhealthy",
      description: "connection refused",
    });
  });

  it("treats a hanging check as unhealthy after the timeout", async () => {
    const hanging: HealthCheck = { name: "slow", check: () => new Promise(() => undefined) };

    const report = await runHealthChecks([hanging], 50);

    expect(report.entries[0]).toMatchObject({ status: "Unhealthy", description: "Timed out after 50 ms." });
  });
});

describe("turnTcpEndpoint", () => {
  it("prefers the TCP transport URL and defaults the port", () => {
    expect(
      turnTcpEndpoint(["turn:a.example:3478?transport=udp", "turn:b.example:5349?transport=tcp"]),
    ).toEqual({
      host: "b.example",
      port: 5349,
    });
    expect(turnTcpEndpoint(["turns:relay.example"])).toEqual({ host: "relay.example", port: 3478 });
    expect(turnTcpEndpoint([])).toBeNull();
  });
});
