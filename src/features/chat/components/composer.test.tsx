import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./composer";

describe("Composer", () => {
  it("sends on Enter and clears the field", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<Composer disabled={false} onSend={onSend} onTyping={vi.fn()} />);

    await user.type(screen.getByLabelText("Message"), "hello{Enter}");

    expect(onSend).toHaveBeenCalledWith("hello");
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  it("adds a new line on Shift+Enter instead of sending", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<Composer disabled={false} onSend={onSend} onTyping={vi.fn()} />);

    await user.type(screen.getByLabelText("Message"), "line one{Shift>}{Enter}{/Shift}line two");

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Message")).toHaveValue("line one\nline two");
  });

  it("reports typing and ignores blank messages", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const onTyping = vi.fn();
    render(<Composer disabled={false} onSend={onSend} onTyping={onTyping} />);

    await user.type(screen.getByLabelText("Message"), "   {Enter}");

    expect(onTyping).toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("is disabled while not connected", () => {
    render(<Composer disabled onSend={vi.fn()} onTyping={vi.fn()} />);
    expect(screen.getByLabelText("Message")).toBeDisabled();
    expect(screen.getByPlaceholderText("Waiting for someone to chat with")).toBeInTheDocument();
  });
});
