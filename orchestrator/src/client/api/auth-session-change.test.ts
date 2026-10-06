import { describe, expect, it, vi } from "vitest";
import {
  __resetApiClientAuthForTests,
  clearAuthSession,
  getAuthSessionVersion,
  setAuthenticatedSession,
  subscribeAuthSession,
} from "./auth-session";

describe("auth-session change signal", () => {
  it("notifies role consumers when the active account changes", () => {
    __resetApiClientAuthForTests();
    const before = getAuthSessionVersion();
    const listener = vi.fn();
    const unsubscribe = subscribeAuthSession(listener);

    setAuthenticatedSession("candidate-token");
    expect(getAuthSessionVersion()).toBe(before + 1);
    expect(listener).toHaveBeenCalledTimes(1);

    clearAuthSession();
    expect(getAuthSessionVersion()).toBe(before + 2);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
