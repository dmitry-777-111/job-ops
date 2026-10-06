import { describe, expect, it } from "vitest";
import { translateUi } from "./i18n";

const onboardingCritical = [
  "Where do you want to work?",
  "Country or market",
  "Preferred cities or regions (optional)",
  "Select country",
  "Search country...",
  "No matching countries.",
  "Workplace style",
  "I need employer visa sponsorship",
  "The JobAgent will show sponsor information and favor sponsor-aware sources when available.",
  "Save and continue",
  "Back",
  "Saving...",
] as const;

describe("onboarding profile localization", () => {
  for (const language of ["es", "fr", "ru", "de"] as const) {
    it(`translates the profile step to ${language}`, () => {
      for (const text of onboardingCritical) {
        expect(translateUi(text, language)).not.toBe(text);
      }
    });
  }
});
