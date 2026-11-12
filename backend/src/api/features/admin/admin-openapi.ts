import type { OpenAPIRegistry, RouteConfig } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  appealDecisionSchema,
  auditQuerySchema,
  banListQuerySchema,
  escalationSchema,
  idParamSchema,
  manualBanSchema,
  reportDecisionSchema,
  reportListQuerySchema,
  staffRolesSchema,
  textRulesSchema,
  userSearchQuerySchema,
} from "../../../application/features/admin/schemas.js";
import type { Permission } from "../../../domain/identity/roles.js";
import { problemDetailsSchema } from "../../openapi/common-schemas.js";

const problem = (description: string) => ({
  description,
  content: { "application/problem+json": { schema: problemDetailsSchema } },
});
const ok = (description: string) => ({
  description,
  content: { "application/json": { schema: z.object({}).loose() } },
});
const body = (schema: z.ZodType) => ({ body: { content: { "application/json": { schema } } } });

interface AdminRoute {
  readonly method: RouteConfig["method"];
  readonly path: string;
  readonly permission: Permission;
  readonly summary: string;
  readonly request?: RouteConfig["request"];
}

const routes: readonly AdminRoute[] = [
  {
    method: "get",
    path: "/dashboard",
    permission: "dashboard.view",
    summary: "Live and recent platform numbers",
  },
  {
    method: "get",
    path: "/reports",
    permission: "reports.review",
    summary: "Review queue (open: by priority, oldest first)",
    request: { query: reportListQuerySchema },
  },
  {
    method: "get",
    path: "/reports/{id}",
    permission: "reports.review",
    summary: "Report with trust scores, history and active bans",
    request: { params: idParamSchema },
  },
  {
    method: "post",
    path: "/reports/{id}/decision",
    permission: "moderation.act",
    summary: "Dismiss, warn or ban (minor-safety reports also need moderation.escalate)",
    request: { params: idParamSchema, ...body(reportDecisionSchema) },
  },
  {
    method: "post",
    path: "/reports/{id}/escalation",
    permission: "moderation.escalate",
    summary: "Record the minor-safety escalation outcome",
    request: { params: idParamSchema, ...body(escalationSchema) },
  },
  {
    method: "get",
    path: "/bans",
    permission: "users.view",
    summary: "Bans (active, pending appeals or all)",
    request: { query: banListQuerySchema },
  },
  {
    method: "post",
    path: "/bans",
    permission: "bans.manage",
    summary: "Ban an account, devices or an IP address (stored hashed)",
    request: body(manualBanSchema),
  },
  {
    method: "post",
    path: "/bans/{id}/lift",
    permission: "bans.manage",
    summary: "Lift a ban",
    request: { params: idParamSchema },
  },
  {
    method: "post",
    path: "/bans/{id}/appeal",
    permission: "appeals.review",
    summary: "Accept (lifts the ban) or reject an appeal",
    request: { params: idParamSchema, ...body(appealDecisionSchema) },
  },
  {
    method: "get",
    path: "/users",
    permission: "users.view",
    summary: "Search accounts by email or id",
    request: { query: userSearchQuerySchema },
  },
  {
    method: "get",
    path: "/users/{id}",
    permission: "users.view",
    summary: "Account with sessions (metadata only), trust, reports and bans",
    request: { params: idParamSchema },
  },
  { method: "get", path: "/rules/text", permission: "rules.manage", summary: "Text moderation rules" },
  {
    method: "put",
    path: "/rules/text",
    permission: "rules.manage",
    summary: "Replace the text moderation rules",
    request: body(textRulesSchema),
  },
  { method: "get", path: "/staff", permission: "staff.manage", summary: "Staff accounts" },
  {
    method: "put",
    path: "/staff/roles",
    permission: "staff.manage",
    summary: "Set an account's staff roles (signs them out everywhere)",
    request: body(staffRolesSchema),
  },
  {
    method: "get",
    path: "/audit",
    permission: "audit.view",
    summary: "Audit log, newest first",
    request: { query: auditQuerySchema },
  },
  {
    method: "get",
    path: "/system",
    permission: "system.view",
    summary: "Dependency health and queue depths",
  },
];

export function registerAdminOpenApi(registry: OpenAPIRegistry): void {
  for (const route of routes) {
    registry.registerPath({
      method: route.method,
      path: `/api/v1/admin${route.path}`,
      tags: ["Admin"],
      summary: route.summary,
      description: `Requires the \`${route.permission}\` permission on a two-factor session.`,
      security: [{ bearerAuth: [] }],
      ...(route.request ? { request: route.request } : {}),
      responses: {
        200: ok("Success"),
        400: problem("Validation failed"),
        401: problem("Not signed in"),
        403: problem("Missing permission or two-factor session"),
        404: problem("Not found"),
        409: problem("Conflict (already decided, concurrent change)"),
      },
    });
  }
}
