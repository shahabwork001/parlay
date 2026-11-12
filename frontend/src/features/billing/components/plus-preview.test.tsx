import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { billingRepository } from "@/repositories/billing-repository";
import { mvpRepository } from "@/repositories/mvp-repository";
import { PlusPreview } from "./plus-preview";
const principal = { emailVerified: true };
vi.mock("@/features/auth/hooks/use-session", () => ({
  useSession: () => ({ isSignedIn: true, principal }),
}));
function show() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <PlusPreview />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(billingRepository, "plans").mockResolvedValue({
    plan: {
      id: "plus",
      name: "Plus",
      amountMinor: 999,
      currency: "USD",
      interval: "month",
      entitlements: [],
    },
    checkoutEnabled: false,
    mock: false,
  });
  vi.spyOn(mvpRepository, "preview").mockResolvedValue(undefined);
  vi.spyOn(mvpRepository, "waitlist").mockResolvedValue({ joined: false });
});
describe("free MVP Plus preview", () => {
  it("requires explicit consent and never starts checkout", async () => {
    const join = vi.spyOn(mvpRepository, "join").mockResolvedValue({ joined: true });
    const checkout = vi.spyOn(billingRepository, "checkout");
    show();
    const button = await screen.findByRole("button", { name: "Join Waitlist" });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(button);
    await waitFor(() => expect(join).toHaveBeenCalledOnce());
    expect(checkout).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Subscribe to Plus" })).not.toBeInTheDocument();
  });
  it("supports removing the signup immediately", async () => {
    vi.spyOn(mvpRepository, "waitlist").mockResolvedValue({ joined: true });
    const leave = vi.spyOn(mvpRepository, "leave").mockResolvedValue(undefined);
    show();
    fireEvent.click(
      await screen.findByRole("button", { name: "Leave waitlist and remove my signup" }),
    );
    await waitFor(() => expect(leave).toHaveBeenCalledOnce());
  });
});
