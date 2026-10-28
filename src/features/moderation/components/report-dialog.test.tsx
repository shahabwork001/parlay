import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { moderationRepository } from "@/repositories/moderation-repository";
import { ReportDialog } from "./report-dialog";

const SESSION = "0199f000-0000-7000-8000-000000000001";

function renderDialog(props: Partial<Parameters<typeof ReportDialog>[0]> = {}) {
  const onReported = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ReportDialog sessionId={SESSION} onReported={onReported} {...props} />
    </QueryClientProvider>,
  );
  return { onReported };
}

afterEach(() => vi.restoreAllMocks());

describe("ReportDialog", () => {
  it("asks for a category, then sends the report with the snapshot", async () => {
    const user = userEvent.setup();
    const submit = vi.spyOn(moderationRepository, "submitReport").mockResolvedValue({ id: "r1" });
    const captureSnapshot = vi.fn().mockResolvedValue("data:image/jpeg;base64,AAAA");
    const { onReported } = renderDialog({ captureSnapshot });

    await user.click(screen.getByRole("button", { name: "Report" }));
    expect(captureSnapshot).toHaveBeenCalledOnce();
    expect(screen.getByText(/still image of their video/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send report" }));
    expect(screen.getByText("Choose what happened.")).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();

    await user.click(screen.getByRole("radio", { name: "Harassment or bullying" }));
    await user.type(screen.getByRole("textbox", { name: /Anything else/ }), "  rude  ");
    await user.click(screen.getByRole("button", { name: "Send report" }));

    expect(submit).toHaveBeenCalledWith({
      sessionId: SESSION,
      category: "harassment",
      note: "rude",
      snapshot: "data:image/jpeg;base64,AAAA",
    });
    expect(onReported).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("explains the minor-safety workflow and shows failures", async () => {
    const user = userEvent.setup();
    vi.spyOn(moderationRepository, "submitReport").mockRejectedValue(new Error("offline"));
    const { onReported } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Report" }));
    expect(screen.getByText(/last messages of this chat/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Appears to be under 18" }));
    expect(screen.getByText(/suspended while we review/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();
    expect(onReported).not.toHaveBeenCalled();
  });

  it("is disabled without a chat to report", () => {
    renderDialog({ sessionId: null });
    expect(screen.getByRole("button", { name: "Report" })).toBeDisabled();
  });
});
