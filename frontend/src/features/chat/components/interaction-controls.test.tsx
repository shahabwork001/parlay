import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InteractionControls } from "./interaction-controls";

const props = () => ({
  interaction: "general" as const,
  selectInteraction: vi.fn(),
  consentRequired: false,
  consent: vi.fn(),
  cancelConsent: vi.fn(),
});
describe("interaction selection and consent", () => {
  it("requires an explicit action to change mode", () => {
    const callbacks = props();
    render(<InteractionControls {...callbacks} />);
    expect(callbacks.selectInteraction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Adult Chat · 18+" }));
    expect(callbacks.selectInteraction).toHaveBeenCalledWith("adult");
    expect(callbacks.consent).not.toHaveBeenCalled();
  });
  it("does not treat opening the consent dialog as consent", () => {
    const callbacks = props();
    render(<InteractionControls {...callbacks} interaction="adult" consentRequired />);
    expect(callbacks.consent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "I consent · Search Adult Chat" }));
    expect(callbacks.consent).toHaveBeenCalledOnce();
  });
  it("lets the user cancel without consenting", () => {
    const callbacks = props();
    render(<InteractionControls {...callbacks} interaction="adult" consentRequired />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(callbacks.cancelConsent).toHaveBeenCalledOnce();
    expect(callbacks.consent).not.toHaveBeenCalled();
  });
});
