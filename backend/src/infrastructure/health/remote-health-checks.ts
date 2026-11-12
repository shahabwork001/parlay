import { connect } from "node:net";
import type { HealthCheck, HealthCheckResult } from "./health-check.js";

/** Reachability of a TCP service (the TURN server's TCP listener). Down means Degraded: chat still works P2P. */
export class TcpHealthCheck implements HealthCheck {
  constructor(
    readonly name: string,
    private readonly host: string,
    private readonly port: number,
  ) {}

  check(signal: AbortSignal): Promise<HealthCheckResult> {
    return new Promise((resolve) => {
      const socket = connect({ host: this.host, port: this.port, signal });
      socket.once("connect", () => {
        socket.destroy();
        resolve({ status: "Healthy" });
      });
      socket.once("error", (error) => {
        resolve({ status: "Degraded", description: error.message });
      });
    });
  }
}

/** Another process's readiness endpoint (the workers). */
export class HttpHealthCheck implements HealthCheck {
  constructor(
    readonly name: string,
    private readonly url: string,
  ) {}

  async check(signal: AbortSignal): Promise<HealthCheckResult> {
    try {
      const response = await fetch(this.url, { signal });
      if (response.ok) return { status: "Healthy" };
      return { status: "Unhealthy", description: `HTTP ${response.status}` };
    } catch (error) {
      return { status: "Unhealthy", description: error instanceof Error ? error.message : String(error) };
    }
  }
}

/** Host and port from the first TURN URL with a TCP transport (or the first URL), e.g. `turn:host:3478?transport=tcp`. */
export function turnTcpEndpoint(urls: readonly string[]): { host: string; port: number } | null {
  const url = urls.find((candidate) => candidate.includes("transport=tcp")) ?? urls[0];
  const match = url ? /^turns?:([^:?]+)(?::(\d+))?/.exec(url) : null;
  if (!match?.[1]) return null;
  return { host: match[1], port: Number(match[2] ?? 3478) };
}
