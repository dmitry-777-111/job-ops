import type { ExtractorManifest } from "@shared/types/extractors";
import { runJobBank } from "./src/run";

export const manifest: ExtractorManifest = {
  id: "jobbank",
  displayName: "Job Bank Canada",
  providesSources: ["jobbank"],
  capabilities: { locationEvidence: true },
  locationCapabilities: {
    jobbank: { supportedCountryKeys: ["canada"] },
  },
  async run(context) {
    if (context.shouldCancel?.()) return { success: true, jobs: [] };
    const result = await runJobBank({
      searchTerms: context.searchTerms,
      shouldCancel: context.shouldCancel,
      onProgress: context.onProgress,
    });
    return result.success
      ? { success: true, jobs: result.jobs, sourceErrors: result.sourceErrors }
      : { success: false, jobs: [], error: result.error };
  },
};

export default manifest;
