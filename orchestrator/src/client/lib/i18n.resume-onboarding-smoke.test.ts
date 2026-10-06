import { describe, expect, it } from "vitest";
import { translateUi } from "./i18n";

const resumeStrings = [
  "Load the resume The JobAgent should use",
  "Upload a file or connect Reactive Resume. After parsing, you'll review the result before anything is marked complete.",
  "Upload a file",
  "Use Reactive Resume",
  "The JobAgent turns a PDF, DOCX, or Reactive Resume JSON into the baseline used for matching and tailoring.",
  "Connect an existing Reactive Resume so The JobAgent can assess fit and build applications from it.",
  "Upload a resume file",
  "Supported formats: PDF, DOCX, and Reactive Resume JSON.",
  "Upload a resume file, or connect Reactive Resume and choose a template. This gives The JobAgent the baseline it needs for matching, fit assessment, and better application workflows.",
  "Resume review",
  "Is this the right resume?",
  "Use this resume",
] as const;

describe("resume onboarding localization", () => {
  for (const language of ["es", "fr", "ru", "de"] as const) {
    it("translates resume onboarding to " + language, () => {
      for (const text of resumeStrings) {
        expect(translateUi(text, language)).not.toBe(text);
      }
    });
  }
});
