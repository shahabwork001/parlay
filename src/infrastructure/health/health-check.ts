export type HealthStatus = "Healthy" | "Degraded" | "Unhealthy";

export interface HealthCheckResult {
  readonly status: HealthStatus;
  /** Internal detail for logs only; never returned by public endpoints. */
  readonly description?: string;
}

export interface HealthCheck {
  readonly name: string;
  check(signal: AbortSignal): Promise<HealthCheckResult>;
}

export interface HealthReport {
  readonly status: HealthStatus;
  readonly entries: readonly (HealthCheckResult & { readonly name: string })[];
}

const SEVERITY: Record<HealthStatus, number> = { Healthy: 0, Degraded: 1, Unhealthy: 2 };

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function runOne(check: HealthCheck, timeoutMs: number): Promise<HealthCheckResult> {
  const signal = AbortSignal.timeout(timeoutMs);
  const timeout = new Promise<HealthCheckResult>((resolve) => {
    signal.addEventListener("abort", () => {
      resolve({ status: "Unhealthy", description: `Timed out after ${timeoutMs} ms.` });
    });
  });
  try {
    return await Promise.race([check.check(signal), timeout]);
  } catch (error) {
    return { status: "Unhealthy", description: describe(error) };
  }
}

/** Runs all checks in parallel; the overall status is the worst individual status. */
export async function runHealthChecks(
  checks: readonly HealthCheck[],
  timeoutMs = 3000,
): Promise<HealthReport> {
  const results = await Promise.all(checks.map((check) => runOne(check, timeoutMs)));
  const entries = results.map((result, index) => ({ ...result, name: checks[index]?.name ?? "unknown" }));
  const status = entries.reduce<HealthStatus>(
    (worst, entry) => (SEVERITY[entry.status] > SEVERITY[worst] ? entry.status : worst),
    "Healthy",
  );
  return { status, entries };
}
