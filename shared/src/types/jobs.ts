import type { ExtractorSourceId } from "../extractors";
import type { LocationEvidence, LocationMatchResult } from "./location";

export type { LocationEvidenceQuality } from "./location";

export type JobLocationEvidence = LocationEvidence;

export type JobStatus =
  | "discovered" // Crawled but not processed
  | "processing" // Currently generating resume
  | "ready" // PDF generated, waiting for user to apply
  | "applied" // Application sent
  | "in_progress" // In process beyond initial application
  | "skipped" // User skipped this job
  | "expired"; // Deadline passed

export const APPLICATION_STAGES = [
  "applied",
  "recruiter_screen",
  "assessment",
  "hiring_manager_screen",
  "technical_interview",
  "onsite",
  "offer",
  "closed",
] as const;

export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export const STAGE_LABELS: Record<ApplicationStage, string> = {
  applied: "Applied",
  recruiter_screen: "Recruiter Screen",
  assessment: "Assessment",
  hiring_manager_screen: "Team Match",
  technical_interview: "Technical Interview",
  onsite: "Final Round",
  offer: "Offer",
  closed: "Closed",
};

export type StageTransitionTarget = ApplicationStage | "no_change";

export const APPLICATION_OUTCOMES = [
  "offer_accepted",
  "offer_declined",
  "rejected",
  "withdrawn",
  "no_response",
  "ghosted",
] as const;

export type JobOutcome = (typeof APPLICATION_OUTCOMES)[number];

export const APPLICATION_TASK_TYPES = [
  "prep",
  "todo",
  "follow_up",
  "check_status",
] as const;

export type ApplicationTaskType = (typeof APPLICATION_TASK_TYPES)[number];

export const INTERVIEW_TYPES = [
  "recruiter_screen",
  "technical",
  "onsite",
  "panel",
  "behavioral",
  "final",
] as const;

export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const INTERVIEW_OUTCOMES = [
  "pass",
  "fail",
  "pending",
  "cancelled",
] as const;

export type InterviewOutcome = (typeof INTERVIEW_OUTCOMES)[number];

export const EVIDENCE_KINDS = [
  "submission",
  "interview",
  "rejection",
  "no_sponsorship",
  "mandatory_license",
  "us_authorization_required",
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const EVIDENCE_SOURCE_TYPES = [
  "manual_verified",
  "gmail_message",
  "calendar_event",
  "document",
  "url",
] as const;
export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export const VERIFIED_JOB_FACT_KEYS = [
  "no_sponsorship",
  "mandatory_license",
  "us_authorization_required",
] as const;
export type VerifiedJobFactKey = (typeof VERIFIED_JOB_FACT_KEYS)[number];

export interface StageEvidence {
  kind: EvidenceKind;
  sourceType: EvidenceSourceType;
  sourceId?: string | null;
  sourceUrl?: string | null;
  note?: string | null;
  verifiedBy: "user";
}

export interface JobVerifiedFact {
  id: string;
  jobId: string;
  factKey: VerifiedJobFactKey;
  evidence: StageEvidence;
  createdAt: string;
  updatedAt: string;
}

export const IMMIGRATION_EMPLOYER_SUPPORT_STATUSES = [
  "unknown",
  "possible",
  "confirmed",
  "not_available",
] as const;
export type ImmigrationEmployerSupportStatus =
  (typeof IMMIGRATION_EMPLOYER_SUPPORT_STATUSES)[number];

export const LMIA_HISTORICAL_SIGNAL_STATUSES = [
  "unknown",
  "none",
  "matched",
] as const;
export type LmiaHistoricalSignalStatus =
  (typeof LMIA_HISTORICAL_SIGNAL_STATUSES)[number];

export interface ImmigrationEvidence {
  sourceType: EvidenceSourceType;
  sourceId?: string | null;
  sourceUrl?: string | null;
  note: string;
  verifiedBy: "user";
}

export interface JobImmigrationProfile {
  jobId: string;
  nocCode: string | null;
  lmiaHistoricalSignal: LmiaHistoricalSignalStatus;
  lmiaLatestQuarter: string | null;
  lmiaStreams: string[];
  lmiaMatchedEmployerNames: string[];
  lmiaMatchedRows: number;
  lmiaSourceUrl: string | null;
  lmiaSourceDate: string | null;
  lmiaLastCheckedAt: string | null;
  employerSupportStatus: ImmigrationEmployerSupportStatus;
  workPermitRequirement: string | null;
  usTravelRequired: boolean | null;
  wageHourlyCad: number | null;
  wageAnnualCad: number | null;
  immigrationNotes: string | null;
  evidence: ImmigrationEvidence[];
  createdAt: string;
  updatedAt: string;
}

export interface JobImmigrationContext {
  profile: JobImmigrationProfile | null;
  verifiedFacts: JobVerifiedFact[];
}

export interface UpdateJobImmigrationProfileInput {
  nocCode?: string | null;
  employerSupportStatus?: ImmigrationEmployerSupportStatus;
  workPermitRequirement?: string | null;
  usTravelRequired?: boolean | null;
  wageHourlyCad?: number | null;
  wageAnnualCad?: number | null;
  immigrationNotes?: string | null;
  evidence?: ImmigrationEvidence[];
}

export const HUMAN_BRIDGE_LEVELS = ["B0", "B1", "B2", "B3"] as const;
export type HumanBridgeLevel = (typeof HUMAN_BRIDGE_LEVELS)[number];

export interface HumanBridgeCompany {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface HumanBridgeContact {
  id: string;
  companyId: string;
  jobId: string | null;
  name: string;
  role: string | null;
  linkedinUrl: string | null;
  influenceScore: number;
  bridgeLevel: HumanBridgeLevel;
  bridgeEvidence: string | null;
  lastContactAt: number | null;
  outcome: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobHumanBridgeContext {
  company: HumanBridgeCompany;
  contacts: HumanBridgeContact[];
}

export interface CreateHumanBridgeContactInput {
  name: string;
  role?: string | null;
  linkedinUrl?: string | null;
  influenceScore?: number;
  bridgeLevel?: HumanBridgeLevel;
  bridgeEvidence?: string | null;
  lastContactAt?: number | null;
  outcome?: string | null;
  linkToJob?: boolean;
}

export interface UpdateHumanBridgeContactInput {
  name?: string;
  role?: string | null;
  linkedinUrl?: string | null;
  influenceScore?: number;
  bridgeLevel?: HumanBridgeLevel;
  bridgeEvidence?: string | null;
  lastContactAt?: number | null;
  outcome?: string | null;
  linkToJob?: boolean;
}

export interface StageEventMetadata {
  evidence?: StageEvidence | null;
  note?: string | null;
  actor?: "system" | "user";
  groupId?: string | null;
  groupLabel?: string | null;
  eventLabel?: string | null;
  externalUrl?: string | null;
  reasonCode?: string | null;
  eventType?: "interview_log" | "status_update" | "note" | null;
}

export interface StageEvent {
  id: string;
  applicationId: string;
  title: string;
  groupId: string | null;
  fromStage: ApplicationStage | null;
  toStage: ApplicationStage;
  occurredAt: number;
  metadata: StageEventMetadata | null;
  outcome: JobOutcome | null;
}

export interface ApplicationTask {
  id: string;
  applicationId: string;
  type: ApplicationTaskType;
  title: string;
  dueDate: number | null;
  isCompleted: boolean;
  notes: string | null;
}

export interface Interview {
  id: string;
  applicationId: string;
  scheduledAt: number;
  durationMins: number | null;
  type: InterviewType;
  outcome: InterviewOutcome | null;
}

export interface JobNote {
  id: string;
  jobId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobDocument {
  id: string;
  jobId: string;
  fileName: string;
  mediaType: string | null;
  byteSize: number;
  createdAt: string;
  updatedAt: string;
}

export type JobSource = ExtractorSourceId | (string & {});

export type JobPdfSource = "generated" | "uploaded";
export type JobPdfFreshness =
  | "missing"
  | "uploaded"
  | "current"
  | "stale"
  | "regenerating";

export interface AppliedDuplicateMatch {
  jobId: string;
  title: string;
  employer: string;
  appliedAt: string;
  score: number;
  titleScore: number;
  employerScore: number;
}

export interface JobBrief {
  role_summary: string;
  they_want: string[];
  specifics: string[];
  company_offers: string[];
  practical_details: string[];
  missing_or_unclear: string[];
  repeated_signals: string[];
}

export interface Job {
  id: string;

  // Source / provenance
  source: JobSource;
  sourceJobId: string | null; // External ID (if provided)
  jobUrlDirect: string | null; // Source-provided direct URL (if provided)
  datePosted: string | null; // Source-provided posting date (if provided)

  // From crawler (normalized)
  title: string;
  employer: string;
  employerUrl: string | null;
  jobUrl: string; // Gradcracker listing URL
  applicationLink: string | null; // Actual application URL
  disciplines: string | null;
  deadline: string | null;
  salary: string | null;
  location: string | null;
  locationEvidence: JobLocationEvidence | null;
  locationMatch?: LocationMatchResult | null;
  degreeRequired: string | null;
  starting: string | null;
  jobDescription: string | null;

  // Orchestrator enrichments
  status: JobStatus;
  outcome: JobOutcome | null;
  closedAt: number | null;
  suitabilityScore: number | null; // 0-100 AI-generated score
  suitabilityReason: string | null; // AI explanation
  jobBrief: string | null; // Generated JD brief (JSON)
  tailoredSummary: string | null; // Generated resume summary
  tailoredHeadline: string | null; // Generated resume headline
  tailoredSkills: string | null; // Generated resume skills (JSON)
  selectedProjectIds: string | null; // Comma-separated IDs of selected projects
  pdfPath: string | null; // Path to generated PDF
  pdfSource: JobPdfSource | null; // Whether PDF was system-generated or user-uploaded
  pdfRegenerating: boolean; // Whether a PDF generation/regeneration is currently in progress for this job
  pdfFreshness: JobPdfFreshness; // Derived freshness state for the current PDF artifact
  pdfFingerprint: string | null; // Stable hash of inputs that produced the current generated PDF
  pdfGeneratedAt: string | null; // Timestamp of the latest generated/uploaded PDF artifact
  tracerLinksEnabled: boolean; // Rewrite outbound resume links to tracer links on next PDF generation
  sponsorMatchScore: number | null; // 0-100 fuzzy match score with visa sponsors
  sponsorMatchNames: string | null; // JSON array of matched sponsor names (when 100% matches or top match)
  appliedDuplicateMatch?: AppliedDuplicateMatch | null; // Included on detail responses and may be omitted on list responses

  // JobSpy fields (nullable for non-JobSpy sources)
  jobType: string | null;
  salarySource: string | null;
  salaryInterval: string | null;
  salaryMinAmount: number | null;
  salaryMaxAmount: number | null;
  salaryCurrency: string | null;
  isRemote: boolean | null;
  jobLevel: string | null;
  jobFunction: string | null;
  listingType: string | null;
  emails: string | null;
  companyIndustry: string | null;
  companyLogo: string | null;
  companyUrlDirect: string | null;
  companyAddresses: string | null;
  companyNumEmployees: string | null;
  companyRevenue: string | null;
  companyDescription: string | null;
  skills: string | null;
  experienceRange: string | null;
  companyRating: number | null;
  companyReviewsCount: number | null;
  vacancyCount: number | null;
  workFromHomeType: string | null;

  // Timestamps
  discoveredAt: string;
  processedAt: string | null;
  readyAt: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type JobListItem = Pick<
  Job,
  | "id"
  | "source"
  | "sourceJobId"
  | "title"
  | "employer"
  | "jobUrl"
  | "applicationLink"
  | "datePosted"
  | "deadline"
  | "salary"
  | "location"
  | "status"
  | "outcome"
  | "closedAt"
  | "suitabilityScore"
  | "sponsorMatchScore"
  | "appliedDuplicateMatch"
  | "jobType"
  | "jobFunction"
  | "pdfRegenerating"
  | "pdfFreshness"
  | "salaryMinAmount"
  | "salaryMaxAmount"
  | "salaryCurrency"
  | "discoveredAt"
  | "readyAt"
  | "appliedAt"
  | "updatedAt"
>;

export interface CreateJobInput {
  source: JobSource;
  title: string;
  employer: string;
  employerUrl?: string;
  jobUrl: string;
  applicationLink?: string;
  disciplines?: string;
  deadline?: string;
  salary?: string;
  location?: string;
  locationEvidence?: JobLocationEvidence;
  degreeRequired?: string;
  starting?: string;
  jobDescription?: string;

  // JobSpy fields (optional)
  sourceJobId?: string;
  jobUrlDirect?: string;
  datePosted?: string;
  jobType?: string;
  salarySource?: string;
  salaryInterval?: string;
  salaryMinAmount?: number;
  salaryMaxAmount?: number;
  salaryCurrency?: string;
  isRemote?: boolean;
  jobLevel?: string;
  jobFunction?: string;
  listingType?: string;
  emails?: string;
  companyIndustry?: string;
  companyLogo?: string;
  companyUrlDirect?: string;
  companyAddresses?: string;
  companyNumEmployees?: string;
  companyRevenue?: string;
  companyDescription?: string;
  skills?: string;
  experienceRange?: string;
  companyRating?: number;
  companyReviewsCount?: number;
  vacancyCount?: number;
  workFromHomeType?: string;
}

export interface ManualJobDraft {
  source?: JobSource;
  sourceJobId?: string;
  title?: string;
  employer?: string;
  jobUrl?: string;
  applicationLink?: string;
  location?: string;
  salary?: string;
  deadline?: string;
  jobDescription?: string;
  jobType?: string;
  jobLevel?: string;
  jobFunction?: string;
  disciplines?: string;
  degreeRequired?: string;
  starting?: string;
}

export interface ManualJobInferenceResponse {
  job: ManualJobDraft;
  warning?: string | null;
}

export interface ManualJobFetchResponse {
  content: string;
  url: string;
}

export interface WatchlistJobState {
  source: JobSource;
  sourceJobId: string;
  state: "ignored" | "moved_to_workspace";
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistJobStatesResponse {
  states: WatchlistJobState[];
}

export interface WatchlistCheck {
  source: JobSource;
  sourceJobIds: string[];
}

export interface WatchlistCheckInput {
  checks: WatchlistCheck[];
}

export interface WatchlistCheckJobDelta {
  source: JobSource;
  sourceJobId: string;
  isNewSinceLastCheck: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface WatchlistCheckResponse {
  previousLastCheckedAt: string | null;
  checkedAt: string;
  jobs: WatchlistCheckJobDelta[];
}

export type WatchedSourceType = "workday" | (string & {});

export interface WatchlistSource {
  id: string;
  label: string;
  careersUrl: string;
  cxsJobsUrl: string | null;
  sourceType: WatchedSourceType;
}

export const MAX_WATCHLIST_SOURCES = 50;

export interface WatchlistSelectedSource {
  id: string;
  catalogSourceId: string | null;
  label: string;
  careersUrl: string;
  cxsJobsUrl: string | null;
  sourceType: WatchedSourceType;
  isCustom: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistSourcesResponse {
  catalogSources: WatchlistSource[];
  selectedSources: WatchlistSelectedSource[];
  availableSourceTypes: WatchlistSourceTypeDescriptor[];
}

export interface WatchlistSourceTypeDescriptor {
  sourceType: WatchedSourceType;
  label: string;
  catalogLabel: string;
  customSourceOptionLabel: string;
  customSourceSearchText: string;
  customSourceInputLabel: string;
  customSourcePlaceholder: string;
  customSourceHelpText: string;
  emptyCatalogText: string;
  fetchingLabel: string;
  invalidUrlMessage: string;
  supportsCustomSource: boolean;
  supportsBranding: boolean;
}

export type WatchlistRowState = "new" | "ignored" | "moved_to_workspace";

export interface WatchlistWorkspaceJobReference {
  id: string;
  status: JobStatus;
}

export interface WatchlistJobResult {
  jobRef: string;
  source: JobSource;
  sourceJobId: string;
  sourceType: WatchedSourceType;
  title: string;
  employer: string;
  jobUrl: string;
  applicationLink: string | null;
  location: string | null;
  postedAt: string | null;
  rowState: WatchlistRowState;
  isNewSinceLastCheck: boolean;
  workspaceJob: WatchlistWorkspaceJobReference | null;
}

export type WatchlistSourceResult =
  | {
      status: "success";
      source: WatchlistSelectedSource;
      jobs: WatchlistJobResult[];
      total: number;
      fetched: number;
    }
  | {
      status: "error";
      source: WatchlistSelectedSource;
      error: string;
    };

export interface WatchlistResultsResponse {
  checkedAt: string | null;
  previousLastCheckedAt: string | null;
  sources: WatchlistSourceResult[];
}

export interface WatchlistImportDraftInput {
  selectedSourceId: string;
  jobRef: string;
}

export interface WatchlistImportDraftResponse {
  draft: ManualJobDraft;
  source: string | null;
  sourceHost: string | null;
  sourceType: WatchedSourceType;
  catalogSourceId: string | null;
  careersUrl: string;
}

export interface WatchlistJobDetailsInput {
  selectedSourceId: string;
  jobRef: string;
}

export interface WatchlistJobDetailsResponse {
  jobRef: string;
  jobUrl: string;
  descriptionHtml: string;
}

export interface WatchlistSourceBrandingInput {
  selectedSourceId?: string | null;
  sourceType: WatchedSourceType;
  careersUrl: string;
}

export interface WatchlistSourceBrandingResponse {
  careersUrl: string;
  logoUrl: string;
  mimeType: string;
  imageDataUrl: string;
}

export interface UpdateWatchlistSelectionsInput {
  selections: Array<{
    catalogSourceId?: string | null;
    sourceType: WatchedSourceType;
    label?: string | null;
    careersUrl: string;
  }>;
}

export const DYNAMIC_EMPLOYER_STATUSES = [
  "discovered",
  "ats_detected",
  "candidate",
  "active",
  "retired",
  "source_changed",
] as const;
export type DynamicEmployerStatus =
  (typeof DYNAMIC_EMPLOYER_STATUSES)[number];

export const DYNAMIC_EMPLOYER_EVENT_TYPES = [
  "observed",
  "ats_detected",
  "candidate",
  "active",
  "retired",
  "source_changed",
] as const;
export type DynamicEmployerEventType =
  (typeof DYNAMIC_EMPLOYER_EVENT_TYPES)[number];

export interface DynamicEmployer {
  id: string;
  normalizedName: string;
  displayName: string;
  status: DynamicEmployerStatus;
  sourceType: WatchedSourceType | null;
  careersUrl: string | null;
  firstSeenSource: JobSource | null;
  firstSeenJobUrl: string | null;
  lastSeenSource: JobSource | null;
  lastSeenJobUrl: string | null;
  observationCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  activatedAt: string | null;
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DynamicEmployerEvent {
  id: string;
  employerId: string;
  eventType: DynamicEmployerEventType;
  fromStatus: DynamicEmployerStatus | null;
  toStatus: DynamicEmployerStatus;
  discoverySource: JobSource | null;
  jobUrl: string | null;
  sourceType: WatchedSourceType | null;
  careersUrl: string | null;
  note: string | null;
  createdAt: string;
}

export interface UpdateJobInput {
  title?: string;
  employer?: string;
  jobUrl?: string;
  applicationLink?: string | null;
  disciplines?: string | null;
  location?: string | null;
  salary?: string | null;
  deadline?: string | null;
  degreeRequired?: string | null;
  starting?: string | null;
  jobType?: string | null;
  salarySource?: string | null;
  salaryInterval?: string | null;
  salaryMinAmount?: number | null;
  salaryMaxAmount?: number | null;
  salaryCurrency?: string | null;
  isRemote?: boolean | null;
  jobLevel?: string | null;
  jobFunction?: string | null;
  companyIndustry?: string | null;
  skills?: string | null;
  experienceRange?: string | null;
  vacancyCount?: number | null;
  workFromHomeType?: string | null;
  status?: JobStatus;
  outcome?: JobOutcome | null;
  closedAt?: number | null;
  jobDescription?: string | null;
  locationEvidence?: JobLocationEvidence | null;
  suitabilityScore?: number | null;
  suitabilityReason?: string;
  jobBrief?: string | null;
  tailoredSummary?: string;
  tailoredHeadline?: string;
  tailoredSkills?: string;
  selectedProjectIds?: string;
  pdfPath?: string;
  pdfSource?: JobPdfSource | null;
  pdfRegenerating?: boolean;
  pdfFingerprint?: string | null;
  pdfGeneratedAt?: string | null;
  tracerLinksEnabled?: boolean;
  readyAt?: string;
  appliedAt?: string;
  sponsorMatchScore?: number;
  sponsorMatchNames?: string;
}

export interface CreateJobNoteInput {
  title: string;
  content: string;
}

export interface UpdateJobNoteInput {
  title: string;
  content: string;
}
