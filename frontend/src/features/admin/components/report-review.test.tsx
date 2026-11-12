import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { permissionsFor } from "@/lib/permissions";
import type { Role } from "@/lib/schemas/auth";
import { adminRepository, type ReportDetail } from "@/repositories/admin-repository";
import { ReportReview } from "./report-review";

const roles = vi.hoisted(() => ({ current: ["Moderator"] as string[] }));
vi.mock("@/features/auth/hooks/use-session", () => ({
  useSession: () => ({ principal: { roles: roles.current, mfa: true } }),
}));

const NOW = new Date().toISOString();

const detail = (
  category: string,
  overrides: Partial<ReportDetail["report"]> = {},
): ReportDetail => ({
  report: {
    id: "r1",
    sessionId: "s1",
    mode: "video",
    category,
    note: "kept insulting me",
    reporter: { subjectId: "a", deviceId: "a", kind: "anonymous" },
    reported: { subjectId: "b", deviceId: "b", kind: "user" },
    hasEvidence: true,
    status: "pending-review",
    priority: 50,
    tier: "normal",
    score: null,
    escalation: null,
    escalationReference: null,
    resolution: null,
    createdAt: NOW,
    scoredAt: null,
    resolvedAt: null,
    ...overrides,
  },
  reporterTrust: 50,
  reportedTrust: 12,
  reportedHistory: { total: 1, upheld: 0, lastDay: 1 },
  reporterHistory: { total: 3, dismissed: 1 },
  activeBans: [],
});

function renderReview(onDecided = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ReportReview reportId="r1" onDecided={onDecided} />
    </QueryClientProvider>,
  );
  return onDecided;
}

beforeEach(() => {
  roles.current = ["Moderator"];
});
afterEach(() => vi.restoreAllMocks());

describe("ReportReview", () => {
  it("shows the report and decides with keyboard shortcuts", async () => {
    const user = userEvent.setup();
    vi.spyOn(adminRepository, "report").mockResolvedValue(detail("harassment"));
    const decide = vi
      .spyOn(adminRepository, "decide")
      .mockResolvedValue(detail("harassment").report);
    const onDecided = renderReview();

    expect(
      await screen.findByRole("heading", { name: "Harassment or bullying" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Account · trust 12 (low)")).toBeInTheDocument();
    expect(screen.getByText("1 report (0 upheld, 1 today)")).toBeInTheDocument();

    await user.keyboard("w");
    expect(decide).toHaveBeenCalledWith("r1", { action: "warn" });
    await vi.waitFor(() => expect(onDecided).toHaveBeenCalled());
  });

  it("opens evidence only on request and keeps the image blurred until revealed", async () => {
    const user = userEvent.setup();
    vi.spyOn(adminRepository, "report").mockResolvedValue(detail("nudity"));
    const evidence = vi.spyOn(adminRepository, "evidence").mockResolvedValue({
      reportId: "r1",
      snapshot: "data:image/jpeg;base64,AAAA",
      messages: [{ from: "reported", text: "hey", sentAt: NOW }],
      expiresAt: NOW,
    });
    renderReview();

    await user.click(await screen.findByRole("button", { name: "View evidence" }));
    expect(evidence).toHaveBeenCalledOnce();
    const image = await screen.findByRole("img", { name: /Still from the reported person/ });
    expect(image).toHaveClass("blur-2xl");
    await user.click(screen.getByRole("button", { name: "Reveal image" }));
    expect(image).not.toHaveClass("blur-2xl");
  });

  it("asks for a ban choice and limits minor-safety decisions to staff who can escalate", async () => {
    const user = userEvent.setup();
    vi.spyOn(adminRepository, "report").mockResolvedValue(
      detail("appears-minor", { tier: "critical", escalation: "required" }),
    );
    const decide = vi
      .spyOn(adminRepository, "decide")
      .mockResolvedValue(detail("appears-minor").report);
    renderReview();

    expect(await screen.findByText(/Minor-safety report/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reference number" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Ban/ }));
    const dialog = screen.getByRole("dialog", { name: "Ban this person" });
    expect(screen.getByRole("radio", { name: "Permanent" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Ban" }));
    expect(decide).toHaveBeenCalledWith("r1", {
      action: "ban",
      mode: "full",
      durationHours: null,
      includeNetwork: false,
    });
    await vi.waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("lets Support read but not decide", async () => {
    roles.current = ["Support"];
    vi.spyOn(adminRepository, "report").mockResolvedValue(detail("spam"));
    renderReview();
    expect(
      await screen.findByText("Your role can review this report but not decide it."),
    ).toBeInTheDocument();
  });
});

describe("permissionsFor", () => {
  it("mirrors the backend role map", () => {
    const of = (role: Role) => [...permissionsFor([role])];
    expect(of("Support")).toEqual(["dashboard.view", "users.view", "appeals.review"]);
    expect(of("Admin")).not.toContain("staff.manage");
    expect(of("SuperAdmin")).toContain("staff.manage");
    expect(permissionsFor([]).size).toBe(0);
  });
});
