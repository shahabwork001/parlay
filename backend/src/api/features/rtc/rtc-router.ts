import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { Router } from "express";
import { z } from "zod";
import type { IceServerProvider } from "../../../application/features/rtc/ice-servers.js";
import { currentPrincipal, requireAuthentication } from "../../auth/authentication.js";
import { problemDetailsSchema } from "../../openapi/common-schemas.js";

const iceServersResponseSchema = z
  .object({
    iceServers: z.array(
      z.object({
        urls: z.array(z.string()),
        username: z.string().optional(),
        credential: z.string().optional(),
      }),
    ),
    ttlSeconds: z.number().int(),
  })
  .meta({ id: "IceServers" });

/** STUN/TURN configuration for the caller. Credentials are per participant and short-lived. */
export function createRtcRouter(iceServers: IceServerProvider): Router {
  const router = Router();
  router.get("/rtc/ice-servers", requireAuthentication, (_request, response) => {
    response.set("Cache-Control", "no-store").json(iceServers.issue(currentPrincipal(response).subjectId));
  });
  return router;
}

export function registerRtcOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: "get",
    path: "/api/v1/rtc/ice-servers",
    tags: ["Video"],
    summary: "STUN and TURN servers with short-lived TURN credentials",
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: "ICE servers",
        content: { "application/json": { schema: iceServersResponseSchema } },
      },
      401: {
        description: "Not signed in",
        content: { "application/problem+json": { schema: problemDetailsSchema } },
      },
    },
  });
}
