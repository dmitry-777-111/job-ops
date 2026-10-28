import { describe, expect, it } from "vitest";
import { extractApplicationRequirements } from "./application-package-requirements";

describe("required skills section", () => {
  it("retains KONE requirements without turning assets or benefits into mandatory facts", () => {
    const rows = extractApplicationRequirements(
      [
        "**Required Skills**",
        "- Ability to read electrical schematics and technical drawings",
        "- Warehouse, logistics, or tool crib experience. This role requires repetitive lifting and handling materials up to 50 lbs",
        "- Lift truck experience (asset)",
        "- Certification is not required.",
        "Some of our many benefits include:",
        "- Paid annual uniform and work shoes",
      ].join("\n"),
    );
    expect(rows.map((row) => row.mandatory)).toEqual([true, true, true, false]);
    expect(
      rows.some((row) =>
        /Required Skills|uniform|Certification/.test(row.text),
      ),
    ).toBe(false);
    expect(rows[0]?.sourceText).toBe(
      "Ability to read electrical schematics and technical drawings",
    );
  });
});
