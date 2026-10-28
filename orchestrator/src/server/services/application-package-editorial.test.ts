import { describe, expect, it } from "vitest";
import {
  editorialCoverMatches,
  normalizeEditorialText,
} from "./application-package-editorial";

describe("deterministic editorial proof", () => {
  const cover =
    "Dear Hiring Team,\nI am applying for this role.\nVerified experience and skills relevant to the posted requirements:\n- Licence examination stage, not licensed.\n- No US travel.\nI would welcome the opportunity to discuss how this verified background relates to the role.\nSincerely,\nCandidate";
  it("allows reordering complete evidence bullets", () => {
    expect(
      editorialCoverMatches(
        cover.replace(
          "- Licence examination stage, not licensed.\n- No US travel.",
          "• No US travel.\n• Licence examination stage, not licensed.",
        ),
        cover,
      ),
    ).toBe(true);
  });
  it.each([
    "No US travel.",
    "not licensed.",
  ])("rejects deleting the constraint %s", (constraint) => {
    expect(editorialCoverMatches(cover.replace(constraint, ""), cover)).toBe(
      false,
    );
  });
  it("does not discard unknown or hidden markup", () => {
    expect(
      normalizeEditorialText('<span style="display:none">not</span> licensed'),
    ).not.toBe("licensed");
  });
});
