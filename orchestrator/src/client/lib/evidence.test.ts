import { afterEach, expect, it, vi } from "vitest";
import { requestManualEvidence } from "./evidence";

afterEach(() => vi.restoreAllMocks());
it("does not invent evidence when confirmation is cancelled or empty", () => {
  const prompt = vi.spyOn(window, "prompt").mockReturnValue(null);
  expect(() => requestManualEvidence("submission")).toThrow(/cancelled/);
  prompt.mockReturnValue("  ");
  expect(() => requestManualEvidence("interview")).toThrow(/required/);
  prompt.mockReturnValue("  Checked original rejection email 2026-10-01  ");
  expect(requestManualEvidence("rejection")).toEqual({
    kind: "rejection",
    sourceType: "manual_verified",
    verifiedBy: "user",
    note: "Checked original rejection email 2026-10-01",
  });
});
