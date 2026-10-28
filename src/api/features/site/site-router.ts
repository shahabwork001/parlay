import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import { z } from "zod";
import type { AuditLog } from "../../../application/features/moderation/ports.js";
import {
  publicSiteConfig,
  type SiteConfigInput,
  type SiteConfigRepository,
  siteConfigSchema,
  UpdateSiteConfig,
} from "../../../application/features/site/site-config.js";
import { currentPrincipal, requirePermission } from "../../auth/authentication.js";
import { validate, validatedInput } from "../../middleware/validate.js";
import { problemDetailsSchema } from "../../openapi/common-schemas.js";

export interface SiteRouterDependencies {
  readonly siteConfig: SiteConfigRepository;
  readonly audit: AuditLog;
}

/** Public site configuration (announcement, maintenance, enabled features) and its admin editor. */
export function createSiteRouter({ siteConfig, audit }: SiteRouterDependencies): Router {
  const router = Router();
  const update = new UpdateSiteConfig(siteConfig, audit, () => new Date());

  router.get("/site", async (_request, response) => {
    response.set("Cache-Control", "public, max-age=15").json(publicSiteConfig(await siteConfig.current()));
  });

  router.get("/admin/site", ...requirePermission("flags.manage"), async (_request, response) => {
    response.set("Cache-Control", "no-store, private").json(await siteConfig.current());
  });

  router.put(
    "/admin/site",
    ...requirePermission("flags.manage"),
    validate({ body: siteConfigSchema }),
    async (_request, response) => {
      response.json(
        await update.execute(currentPrincipal(response), validatedInput<SiteConfigInput>(response).body),
      );
    },
  );

  return router;
}

const publicSchema = siteConfigSchema.meta({ id: "SiteConfig" });

export function registerSiteOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: "get",
    path: "/api/v1/site",
    tags: ["Site"],
    summary: "Announcement, maintenance mode and enabled features (cached 15 s)",
    responses: {
      200: { description: "Site configuration", content: { "application/json": { schema: publicSchema } } },
    },
  });
  for (const method of ["get", "put"] as const) {
    registry.registerPath({
      method,
      path: "/api/v1/admin/site",
      tags: ["Admin"],
      summary: method === "get" ? "Site configuration with editor details" : "Replace the site configuration",
      description: "Requires the `flags.manage` permission on a two-factor session.",
      security: [{ bearerAuth: [] }],
      ...(method === "put"
        ? { request: { body: { content: { "application/json": { schema: siteConfigSchema } } } } }
        : {}),
      responses: {
        200: {
          description: "Configuration",
          content: { "application/json": { schema: z.object({}).loose() } },
        },
        403: {
          description: "Forbidden",
          content: { "application/problem+json": { schema: problemDetailsSchema } },
        },
      },
    });
  }
}
