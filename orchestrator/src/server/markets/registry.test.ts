import { describe, expect, it } from "vitest";
import { getMarketAdapter, listMarketAdapters } from "./registry";

describe("market adapter registry", () => {
  it("registers Canada behind a generic market contract", () => {
    const canada = getMarketAdapter("Canada");
    expect(canada?.id).toBe("canada");
    expect(canada?.defaultCurrency).toBe("CAD");
    expect(canada?.occupationSystem?.id).toBe("noc");
  });

  it("does not imply that unimplemented countries are enabled", () => {
    expect(getMarketAdapter("united states")).toBeNull();
    expect(listMarketAdapters().map((adapter) => adapter.id)).toEqual([
      "canada",
    ]);
  });
});
