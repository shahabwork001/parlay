import { beforeEach, describe, expect, it } from "vitest";
import { useChatStore } from "./chat-store";

const match = {
  sessionId: "s1",
  mode: "text" as const,
  role: "caller" as const,
  sharedInterests: ["chess"],
};

describe("chat store", () => {
  beforeEach(() => {
    useChatStore.getState().reset();
  });

  it("moves from searching to chatting on a match", () => {
    const store = useChatStore.getState();
    store.searching();
    store.matched(match);

    expect(useChatStore.getState()).toMatchObject({
      phase: "chatting",
      sessionId: "s1",
      sharedInterests: ["chess"],
    });
  });

  it("tracks own messages from sending to delivered, keeping the server-filtered text", () => {
    const store = useChatStore.getState();
    store.matched(match);
    store.addOwnMessage("local-1", "hello www.x.com");
    expect(useChatStore.getState().messages[0]).toMatchObject({ status: "sending" });

    store.confirmOwnMessage("local-1", { id: "m1", text: "hello [link removed]", sentAt: "" });

    expect(useChatStore.getState().messages[0]).toEqual({
      id: "m1",
      author: "me",
      text: "hello [link removed]",
      status: "sent",
    });
  });

  it("marks failed messages", () => {
    const store = useChatStore.getState();
    store.matched(match);
    store.addOwnMessage("local-1", "hi");
    store.failOwnMessage("local-1");
    expect(useChatStore.getState().messages[0]?.status).toBe("failed");
  });

  it("clears the typing indicator when the partner's message arrives", () => {
    const store = useChatStore.getState();
    store.matched(match);
    store.setPartnerTyping(true);
    store.receiveMessage({ id: "m2", text: "hey", sentAt: "" });

    expect(useChatStore.getState()).toMatchObject({ partnerTyping: false });
    expect(useChatStore.getState().messages.at(-1)).toMatchObject({
      author: "partner",
      text: "hey",
    });
  });

  it("ends a chat but keeps the transcript visible", () => {
    const store = useChatStore.getState();
    store.matched(match);
    store.receiveMessage({ id: "m2", text: "bye", sentAt: "" });
    store.ended("skipped");

    expect(useChatStore.getState()).toMatchObject({ phase: "ended", endedReason: "skipped" });
    expect(useChatStore.getState().messages).toHaveLength(1);
  });

  it("ignores end events after the user stopped", () => {
    const store = useChatStore.getState();
    store.matched(match);
    store.stopped();
    store.ended("disconnected");

    expect(useChatStore.getState().phase).toBe("stopped");
  });

  it("starts each search with an empty conversation", () => {
    const store = useChatStore.getState();
    store.matched(match);
    store.receiveMessage({ id: "m2", text: "hey", sentAt: "" });
    store.searching();

    expect(useChatStore.getState()).toMatchObject({
      phase: "searching",
      messages: [],
      sessionId: null,
    });
  });
});
