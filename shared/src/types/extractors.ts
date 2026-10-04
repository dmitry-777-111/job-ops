import type { CreateJobInput } from "./jobs";
import type {
  LocationIntent,
  LocationSourceCapabilitiesInput,
  SourceLocationPlan,
} from "./location";

export interface ExtractorProgressEvent {
  phase?: "list" | "job";
  currentUrl?: string;
  termsProcessed?: number;
  termsTotal?: number;
  listPagesProcessed?: number;
  listPagesTotal?: number;
  jobCardsFound?: number;
  jobPagesEnqueued?: number;
  jobPagesSkipped?: number;
  jobPagesProcessed?: number;
  detail?: string;
}

export interface ExtractorCapabilities {
  locationEvidence?: boolean;
  /** Public extractor output may be reused across candidate scopes only when
   * the runtime fingerprint is identical. Private/account-specific extractors
   * must leave this unset. */
  shareablePublicDiscovery?: boolean;
}

export type ExtractorSourceLocationCapabilities = Omit<
  LocationSourceCapabilitiesInput,
  "source"
>;

export interface ExtractorRuntimeContext {
  source: string;
  selectedSources: string[];
  settings: Record<string, string | undefined>;
  searchTerms: string[];
  selectedCountry: string;
  locationIntent?: LocationIntent;
  sourceLocationPlan?: SourceLocationPlan;
  getExistingJobUrls?: () => Promise<string[]>;
  shouldCancel?: () => boolean;
  resumeCheckpoint?: unknown;
  onCheckpoint?: (checkpoint: unknown) => void | Promise<void>;
  onProgress?: (event: ExtractorProgressEvent) => void;
}

export interface ExtractorRunResult {
  success: boolean;
  jobs: CreateJobInput[];
  error?: string;
  sourceErrors?: string[];
  /** When set, the extractor failed because a Cloudflare challenge couldn't be
   *  solved headless. The value is the URL that needs a human to solve it in a
   *  headed browser. The pipeline should pause and prompt the user. */
  challengeRequired?: string;
}

export interface ExtractorManifest {
  id: string;
  displayName: string;
  providesSources: readonly string[];
  requiredEnvVars?: readonly string[];
  capabilities?: ExtractorCapabilities;
  locationCapabilities?: Partial<
    Record<string, ExtractorSourceLocationCapabilities>
  >;
  run: (context: ExtractorRuntimeContext) => Promise<ExtractorRunResult>;
}
