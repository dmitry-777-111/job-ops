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
  "Job-platform profiles",
  "Add links to your job-platform profiles",
  "Paste links to the profiles you use on job-search platforms. The JobAgent will later use them to assess profile completeness, positioning and consistency and suggest improvements.",
  "Job-platform profile link",
  "Remove link",
  "Add another link",
  "Skip for now",
  "Save and finish",
  "You can add up to 6 profile links.",
  "Use a full http:// or https:// profile link.",
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
