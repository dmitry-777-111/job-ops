import { describe, expect, it } from "vitest";
import {
  CANDIDATE_NAV_LINKS,
  isNavActive,
  NAV_LINKS,
  resolveNavLinks,
} from "./navigation";

describe("candidate navigation", () => {
  it("shows the six product destinations to a hosted candidate", () => {
    const links = resolveNavLinks({
      appMode: "hosted",
      isSystemAdmin: false,
    });

    expect(links.map((link) => [link.label, link.to])).toEqual([
      ["Today", "/overview"],
      ["Matches", "/jobs/ready"],
      ["Applications", "/applications/in-progress"],
      ["Improve", "/improve"],
      ["Profile", "/design-resume"],
      ["Connections", "/settings"],
    ]);
    expect(links).toEqual(CANDIDATE_NAV_LINKS);
  });

  it("keeps advanced navigation for a hosted system admin without hosted-only unsupported inbox", () => {
    const links = resolveNavLinks({
      appMode: "hosted",
      isSystemAdmin: true,
    });

    expect(links.some((link) => link.label === "Tracer Links")).toBe(true);
    expect(links.some((link) => link.label === "Visa Sponsors")).toBe(true);
    expect(links.some((link) => link.label === "Watchlist")).toBe(true);
    expect(links.some((link) => link.to === "/tracking-inbox")).toBe(false);
  });

  it("keeps the simplified candidate navigation in local mode", () => {
    expect(resolveNavLinks({ appMode: "local", isSystemAdmin: false })).toEqual(
      CANDIDATE_NAV_LINKS,
    );
  });

  it("keeps the advanced local navigation for a system admin", () => {
    expect(resolveNavLinks({ appMode: "local", isSystemAdmin: true })).toEqual(
      NAV_LINKS,
    );
  });

  it("keeps candidate match paths active across job views", () => {
    const matches = CANDIDATE_NAV_LINKS.find(
      (link) => link.label === "Matches",
    );
    expect(matches).toBeDefined();
    if (!matches) throw new Error("Matches navigation link is missing");
    expect(
      isNavActive("/jobs/discovered/some-job", matches.to, matches.activePaths),
    ).toBe(true);
  });
});
