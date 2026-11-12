import { OpenApiGeneratorV31, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

const healthStatus = z.enum(["Healthy", "Degraded", "Unhealthy"]);

const healthReport = z
  .object({
    status: healthStatus,
    checks: z.array(z.object({ name: z.string(), status: healthStatus })),
  })
  .meta({ id: "HealthReport" });

function registerHealth(registry: OpenAPIRegistry): void {
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
}

export type OpenApiRegistration = (registry: OpenAPIRegistry) => void;

/** Builds the OpenAPI 3.1 document from the health routes plus each feature's registration. */
export function buildOpenApiDocument(
  registrations: readonly OpenApiRegistration[],
): ReturnType<OpenApiGeneratorV31["generateDocument"]> {
  const registry = new OpenAPIRegistry();
  registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });
  registerHealth(registry);
  for (const register of registrations) register(registry);

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: { title: "Parley API", version: "0.2.0" },
  });
}
