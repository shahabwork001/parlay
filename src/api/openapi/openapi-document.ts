import { OpenApiGeneratorV31, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

const healthStatus = z.enum(["Healthy", "Degraded", "Unhealthy"]);

const healthReport = z
  .object({
    status: healthStatus,
    checks: z.array(z.object({ name: z.string(), status: healthStatus })),
  })
  .meta({ id: "HealthReport" });

function buildRegistry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();
  registry.registerPath({
    method: "get",
    path: "/health/live",
    tags: ["Health"],
    summary: "Liveness: the process is running",
    responses: { 200: { description: "Alive", content: { "application/json": { schema: healthReport } } } },
  });

  registry.registerPath({
    method: "get",
    path: "/health/ready",
    tags: ["Health"],
    summary: "Readiness: MongoDB, Redis and RabbitMQ are reachable",
    responses: {
      200: { description: "Ready", content: { "application/json": { schema: healthReport } } },
      503: {
        description: "A dependency is unhealthy",
        content: { "application/json": { schema: healthReport } },
      },
    },
  });

  return registry;
}

export function buildOpenApiDocument(): ReturnType<OpenApiGeneratorV31["generateDocument"]> {
  return new OpenApiGeneratorV31(buildRegistry().definitions).generateDocument({
    openapi: "3.1.0",
    info: { title: "Parley API", version: "0.1.0" },
  });
}
