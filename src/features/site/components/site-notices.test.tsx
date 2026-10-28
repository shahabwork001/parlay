import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StartChatActions } from "@/features/landing/components/start-chat-actions";
import { DEFAULT_SITE_CONFIG, siteRepository } from "@/repositories/site-repository";
import { SiteNotices } from "./site-notices";

vi.mock("@/features/terms-gate/hooks/use-start-chat", () => ({
  useStartChat: () => ({
    start: vi.fn(),
    accept: vi.fn(),
    cancel: vi.fn(),
    gateOpen: false,
    submitting: false,
    error: null,
  }),
}));

function withQueries(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => vi.restoreAllMocks());

describe("site notices", () => {
  it("show nothing by default", async () => {
    const current = vi.spyOn(siteRepository, "current").mockResolvedValue(DEFAULT_SITE_CONFIG);
    const { container } = render(withQueries(<SiteNotices />));
    await vi.waitFor(() => expect(current).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("show maintenance and the announcement, and pause the start buttons", async () => {
    vi.spyOn(siteRepository, "current").mockResolvedValue({
      maintenance: { enabled: true, message: "Back at noon." },
      announcement: { message: "Video is in beta.", tone: "info" },
      features: { textChat: true, videoChat: true, registration: true },
    });
    render(
      withQueries(
        <>
          <SiteNotices />
          <StartChatActions />
        </>,
      ),
    );

    expect(await screen.findByText("Video is in beta.")).toBeInTheDocument();
    expect(screen.getAllByText("Back at noon.")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Start video" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Start text" })).toBeDisabled();
  });

  it("disable only the paused chat mode", async () => {
    vi.spyOn(siteRepository, "current").mockResolvedValue({
      ...DEFAULT_SITE_CONFIG,
      features: { textChat: true, videoChat: false, registration: true },
    });
    render(withQueries(<StartChatActions />));

    expect(
      await screen.findByText("Video chat is paused right now; text chat is open."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start video" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Start text" })).toBeEnabled();
  });
});
