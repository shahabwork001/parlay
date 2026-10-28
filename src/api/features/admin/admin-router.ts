import { type Response, Router } from "express";
import type { AdminContext } from "../../../application/features/admin/admin-context.js";
import { AdminErrors } from "../../../application/features/admin/admin-errors.js";
import {
  GetDashboard,
  GetReportDetail,
  GetUserDetail,
} from "../../../application/features/admin/admin-queries.js";
import { DecideAppeal, IssueManualBan, LiftBan } from "../../../application/features/admin/ban-actions.js";
import { DecideReport, RecordEscalation } from "../../../application/features/admin/report-decisions.js";
import {
  type AuditQueryInput,
  appealDecisionSchema,
  auditQuerySchema,
  type BanListQueryInput,
  banListQuerySchema,
  type EscalationInput,
  escalationSchema,
  idParamSchema,
  type ManualBanInput,
  manualBanSchema,
  type ReportDecisionInput,
  type ReportListQueryInput,
  reportDecisionSchema,
  reportListQuerySchema,
  type StaffRolesInput,
  staffRolesSchema,
  type TextRulesInput,
  textRulesSchema,
  type UserSearchQueryInput,
  userSearchQuerySchema,
} from "../../../application/features/admin/schemas.js";
import { SetStaffRoles, UpdateTextRules } from "../../../application/features/admin/staff-and-rules.js";
import { createPageRequest } from "../../../application/common/paging.js";
import { type HealthCheck, runHealthChecks } from "../../../infrastructure/health/health-check.js";
import { currentPrincipal, requirePermission } from "../../auth/authentication.js";
import { sendAppError } from "../../http/problem-details.js";
import { validate, validatedInput } from "../../middleware/validate.js";
import { toBanView, toReportView, toUserView } from "./admin-contract.js";

export interface AdminRouterDependencies {
  readonly context: AdminContext;
  /** API dependencies plus TURN and the workers, for the system-health view. */
  readonly healthChecks: readonly HealthCheck[];
}

const noStore = (response: Response) => response.set("Cache-Control", "no-store, private");

/** Staff API under /api/v1/admin. Every route needs a permission and a two-factor session. */
export function createAdminRouter({ context, healthChecks }: AdminRouterDependencies): Router {
  const router = Router();
  const getDashboard = new GetDashboard(context);
  const getReportDetail = new GetReportDetail(context);
  const getUserDetail = new GetUserDetail(context);
  const decideReport = new DecideReport(context);
  const recordEscalation = new RecordEscalation(context);
  const issueManualBan = new IssueManualBan(context);
  const liftBan = new LiftBan(context);
  const decideAppeal = new DecideAppeal(context);
  const setStaffRoles = new SetStaffRoles(context);
  const updateTextRules = new UpdateTextRules(context);
  const id = (response: Response) => validatedInput<undefined, undefined, { id: string }>(response).params.id;

  router.get("/admin/dashboard", ...requirePermission("dashboard.view"), async (_request, response) => {
    noStore(response).json(await getDashboard.execute());
  });

  router.get(
    "/admin/reports",
    ...requirePermission("reports.review"),
    validate({ query: reportListQuerySchema }),
    async (_request, response) => {
      const query = validatedInput<undefined, ReportListQueryInput>(response).query;
      noStore(response).json(
        await context.readModel.listReports({
          status: query.status,
          tier: query.tier,
          reportedSubjectId: query.reportedSubjectId,
          page: createPageRequest(query.page, query.pageSize),
        }),
      );
    },
  );

  router.get(
    "/admin/reports/:id",
    ...requirePermission("reports.review"),
    validate({ params: idParamSchema }),
    async (request, response) => {
      const detail = await getReportDetail.execute(id(response));
      if (!detail) {
        sendAppError(request, response, AdminErrors.reportNotFound);
        return;
      }
      noStore(response).json({ ...detail, report: toReportView(detail.report) });
    },
  );

  router.post(
    "/admin/reports/:id/decision",
    ...requirePermission("moderation.act"),
    validate({ params: idParamSchema, body: reportDecisionSchema }),
    async (request, response) => {
      const result = await decideReport.execute(
        currentPrincipal(response),
        id(response),
        validatedInput<ReportDecisionInput>(response).body,
      );
      if (!result.ok) {
        sendAppError(request, response, result.error);
        return;
      }
      response.json(toReportView(result.value));
    },
  );

  router.post(
    "/admin/reports/:id/escalation",
    ...requirePermission("moderation.escalate"),
    validate({ params: idParamSchema, body: escalationSchema }),
    async (request, response) => {
      const result = await recordEscalation.execute(
        currentPrincipal(response),
        id(response),
        validatedInput<EscalationInput>(response).body,
      );
      if (!result.ok) {
        sendAppError(request, response, result.error);
        return;
      }
      response.json(toReportView(result.value));
    },
  );

  // Support reviews appeals, Moderators manage bans; both need to see the list.
  router.get(
    "/admin/bans",
    ...requirePermission("users.view"),
    validate({ query: banListQuerySchema }),
    async (_request, response) => {
      const query = validatedInput<undefined, BanListQueryInput>(response).query;
      noStore(response).json(
        await context.readModel.listBans(
          {
            filter: query.filter,
            targetValue: query.target,
            page: createPageRequest(query.page, query.pageSize),
          },
          context.clock(),
        ),
      );
    },
  );

  router.post(
    "/admin/bans",
    ...requirePermission("bans.manage"),
    validate({ body: manualBanSchema }),
    async (request, response) => {
      const body = validatedInput<ManualBanInput>(response).body;
      const result = await issueManualBan.execute(currentPrincipal(response), body);
      if (!result.ok) {
        sendAppError(request, response, result.error);
        return;
      }
      response.status(201).json(toBanView(result.value));
    },
  );

  router.post(
    "/admin/bans/:id/lift",
    ...requirePermission("bans.manage"),
    validate({ params: idParamSchema }),
    async (request, response) => {
      const result = await liftBan.execute(currentPrincipal(response), id(response));
      if (!result.ok) {
        sendAppError(request, response, result.error);
        return;
      }
      response.json(toBanView(result.value));
    },
  );

  router.post(
    "/admin/bans/:id/appeal",
    ...requirePermission("appeals.review"),
    validate({ params: idParamSchema, body: appealDecisionSchema }),
    async (request, response) => {
      const result = await decideAppeal.execute(
        currentPrincipal(response),
        id(response),
        validatedInput<{ accept: boolean }>(response).body.accept,
      );
      if (!result.ok) {
        sendAppError(request, response, result.error);
        return;
      }
      response.json(toBanView(result.value));
    },
  );

  router.get(
    "/admin/users",
    ...requirePermission("users.view"),
    validate({ query: userSearchQuerySchema }),
    async (_request, response) => {
      const query = validatedInput<undefined, UserSearchQueryInput>(response).query;
      noStore(response).json(
        await context.readModel.searchUsers(query.q, createPageRequest(query.page, query.pageSize)),
      );
    },
  );

  router.get(
    "/admin/users/:id",
    ...requirePermission("users.view"),
    validate({ params: idParamSchema }),
    async (request, response) => {
      const detail = await getUserDetail.execute(id(response));
      if (!detail) {
        sendAppError(request, response, AdminErrors.userNotFound);
        return;
      }
      noStore(response).json({ ...detail, user: toUserView(detail.user) });
    },
  );

  router.get("/admin/rules/text", ...requirePermission("rules.manage"), async (_request, response) => {
    noStore(response).json(await context.textRules.current());
  });

  router.put(
    "/admin/rules/text",
    ...requirePermission("rules.manage"),
    validate({ body: textRulesSchema }),
    async (_request, response) => {
      response.json(
        await updateTextRules.execute(
          currentPrincipal(response),
          validatedInput<TextRulesInput>(response).body,
        ),
      );
    },
  );

  router.get("/admin/staff", ...requirePermission("staff.manage"), async (_request, response) => {
    noStore(response).json({ items: await context.readModel.listStaff() });
  });

  router.put(
    "/admin/staff/roles",
    ...requirePermission("staff.manage"),
    validate({ body: staffRolesSchema }),
    async (request, response) => {
      const body = validatedInput<StaffRolesInput>(response).body;
      const result = await setStaffRoles.execute(
        currentPrincipal(response),
        { userId: body.userId, email: body.email },
        body.roles,
      );
      if (!result.ok) {
        sendAppError(request, response, result.error);
        return;
      }
      response.json(toUserView(result.value));
    },
  );

  router.get(
    "/admin/audit",
    ...requirePermission("audit.view"),
    validate({ query: auditQuerySchema }),
    async (_request, response) => {
      const query = validatedInput<undefined, AuditQueryInput>(response).query;
      noStore(response).json(
        await context.readModel.listAudit({
          action: query.action || undefined,
          actorId: query.actorId || undefined,
          targetId: query.targetId || undefined,
          page: createPageRequest(query.page, query.pageSize),
        }),
      );
    },
  );

  router.get("/admin/system", ...requirePermission("system.view"), async (_request, response) => {
    const [health, queues] = await Promise.all([runHealthChecks(healthChecks), context.queues.depths()]);
    noStore(response).json({ health, queues, checkedAt: context.clock() });
  });

  return router;
}
