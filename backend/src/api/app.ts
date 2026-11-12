import { randomUUID } from "node:crypto";
import { apiReference } from "@scalar/express-api-reference";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express, type RequestHandler, type Router } from "express";
import { pinoHttp } from "pino-http";
import type { HealthCheck } from "../infrastructure/health/health-check.js";
import { createHealthRouter } from "../infrastructure/health/health-router.js";
import type { Logger } from "../infrastructure/observability/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handlers.js";
import { apiSecurityHeaders, docsSecurityHeaders } from "./middleware/security-headers.js";
import { buildOpenApiDocument, type OpenApiRegistration } from "./openapi/openapi-document.js";

/** A feature's HTTP surface: a router mounted under /api/v1 and its OpenAPI registration. */
export interface ApiFeature {
  readonly router: Router;
  readonly openApi: OpenApiRegistration;
}

export interface AppDependencies {
  readonly logger: Logger;
  readonly corsAllowedOrigins: readonly string[];
  readonly healthChecks: readonly HealthCheck[];
  readonly enableApiReference: boolean;
  /** Express "trust proxy" value so req.ip is the real client behind load balancers. */
  readonly trustProxy: string;
  /** Resolves the caller from the access token (sets res.locals.principal). */
  readonly authenticate: RequestHandler;
  readonly features: readonly ApiFeature[];
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

/** Builds the HTTP app. Stateless: all state lives in Mongo/Redis so instances scale horizontally. */
export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", dependencies.trustProxy);

  app.use(
    pinoHttp({
      logger: dependencies.logger,
      genReqId: (request, response) => {
        const incoming = request.headers["x-request-id"];
        const id =
          typeof incoming === "string" && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
        response.setHeader("X-Request-Id", id);
        return id;
      },
      autoLogging: { ignore: (request) => request.url.startsWith("/health") },
      // Log only what is needed to trace a request: never IP addresses or headers (privacy).
      serializers: {
        req: (request: { id: unknown; method: unknown; url: unknown }) => ({
          id: request.id,
          method: request.method,
          url: request.url,
        }),
        res: (response: { statusCode: unknown }) => ({ statusCode: response.statusCode }),
      },
      customLogLevel: (_request, response, error) =>
        error || response.statusCode >= 500 ? "error" : response.statusCode >= 400 ? "warn" : "info",
    }),
  );
  app.use(apiSecurityHeaders);
  app.use(
    cors({
      origin: [...dependencies.corsAllowedOrigins],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      maxAge: 3600,
    }),
  );
  app.use(compression());
  app.use("/api/v1/billing/webhooks", express.raw({ type: "application/json", limit: "100kb" }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.use(createHealthRouter(dependencies.healthChecks, dependencies.logger));
  app.use("/api/v1", dependencies.authenticate, ...dependencies.features.map((feature) => feature.router));

  if (dependencies.enableApiReference) {
    const document = buildOpenApiDocument(dependencies.features.map((feature) => feature.openApi));
    app.get("/openapi.json", (_request, response) => {
      response.json(document);
    });
    app.use("/scalar", docsSecurityHeaders, apiReference({ url: "/openapi.json", pageTitle: "Parley API" }));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
