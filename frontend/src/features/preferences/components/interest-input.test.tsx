import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { usePreferencesStore } from "../store/preferences-store";
import { InterestInput } from "./interest-input";

describe("InterestInput", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ interests: [], language: "any" });
  });

  it("adds a normalized interest when Enter is pressed", async () => {
    const user = userEvent.setup();
    render(<InterestInput />);

    await user.type(screen.getByLabelText("Interests"), "  Chess {Enter}");

    expect(screen.getByRole("list", { name: "Selected interests" })).toHaveTextContent("chess");
    expect(usePreferencesStore.getState().interests).toEqual(["chess"]);
  });

  it("shows a validation error for invalid interests", async () => {
    const user = userEvent.setup();
    render(<InterestInput />);

    await user.type(screen.getByLabelText("Interests"), "a{Enter}");

    expect(screen.getByRole("alert")).toHaveTextContent("Use at least 2 characters.");
    expect(usePreferencesStore.getState().interests).toEqual([]);
  });

  it("removes an interest with its remove button", async () => {
    usePreferencesStore.setState({ interests: ["music"] });
    const user = userEvent.setup();
    render(<InterestInput />);

    await user.click(screen.getByRole("button", { name: "Remove music" }));

    expect(usePreferencesStore.getState().interests).toEqual([]);
  });
});
