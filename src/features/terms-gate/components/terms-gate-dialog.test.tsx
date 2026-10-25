import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TermsGateDialog } from "./terms-gate-dialog";

function renderGate(overrides: Partial<Parameters<typeof TermsGateDialog>[0]> = {}) {
  const props = {
    open: true,
    submitting: false,
    error: null,
    onAccept: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<TermsGateDialog {...props} />);
  return props;
}

describe("TermsGateDialog", () => {
  it("requires both the age confirmation and the terms before continuing", async () => {
    const user = userEvent.setup();
    const { onAccept } = renderGate();
    const agree = screen.getByRole("button", { name: "Agree and continue" });

    expect(agree).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "I am 18 or older." }));
    expect(agree).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /I agree to the Terms/ }));
    expect(agree).toBeEnabled();

    await user.click(agree);
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it("links to the Terms and Community Guidelines", () => {
    renderGate();
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Community Guidelines" })).toHaveAttribute(
      "href",
      "/guidelines",
    );
  });

  it("shows errors and lets the user cancel", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderGate({ error: "We could not reach Parley." });

    expect(screen.getByText("We could not reach Parley.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
