import { beforeEach, describe, expect, it } from "vitest";
import { clearSession, sessionStore, whenSessionReady } from "./session-store";

describe("whenSessionReady", () => {
  beforeEach(() => {
    sessionStore.setState({ status: "restoring", session: null });
  });

  it("waits for the restore to finish", async () => {
    let resolved = false;
    const ready = whenSessionReady().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    clearSession();
    await ready;
    expect(resolved).toBe(true);
  });

  it("resolves immediately when already ready", async () => {
    clearSession();
    await expect(whenSessionReady()).resolves.toBeUndefined();
  });
});
