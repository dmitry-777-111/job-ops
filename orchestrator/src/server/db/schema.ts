/**
 * Database schema using Drizzle ORM with SQLite.
 */

import {
  APPLICATION_OUTCOMES,
  APPLICATION_STAGES,
  APPLICATION_TASK_TYPES,
  DYNAMIC_EMPLOYER_EVENT_TYPES,
  DYNAMIC_EMPLOYER_STATUSES,
  HOSTED_USAGE_ACTIONS,
  HUMAN_BRIDGE_LEVELS,
  IMMIGRATION_EMPLOYER_SUPPORT_STATUSES,
  INTERVIEW_OUTCOMES,
  INTERVIEW_TYPES,
  JOB_CHAT_MESSAGE_ROLES,
  JOB_CHAT_MESSAGE_STATUSES,
  JOB_CHAT_RUN_STATUSES,
  LMIA_HISTORICAL_SIGNAL_STATUSES,
  POST_APPLICATION_INTEGRATION_STATUSES,
  POST_APPLICATION_MESSAGE_TYPES,
  POST_APPLICATION_PROCESSING_STATUSES,
  POST_APPLICATION_PROVIDERS,
  POST_APPLICATION_RELEVANCE_DECISIONS,
  POST_APPLICATION_SYNC_RUN_STATUSES,
  VERIFIED_JOB_FACT_KEYS,
} from "@shared/types";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    displayName: text("display_name"),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    isSystemAdmin: integer("is_system_admin", { mode: "boolean" })
      .notNull()
      .default(false),
    isDisabled: integer("is_disabled", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    usernameUnique: uniqueIndex("idx_users_username_unique").on(table.username),
  }),
);

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const tenantMemberships = sqliteTable(
  "tenant_memberships",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member"] })
      .notNull()
      .default("owner"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    userTenantUnique: uniqueIndex("idx_tenant_memberships_user_tenant").on(
      table.userId,
      table.tenantId,
    ),
    tenantIndex: index("idx_tenant_memberships_tenant_id").on(table.tenantId),
  }),
);

export const accountSubscriptions = sqliteTable(
  "account_subscriptions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripeSubscriptionCreatedAt: integer("stripe_subscription_created_at", {
      mode: "number",
    }),
    stripePriceId: text("stripe_price_id"),
    stripeStatus: text("stripe_status"),
    currentPeriodEnd: integer("current_period_end", { mode: "number" }),
    cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserUnique: uniqueIndex(
      "idx_account_subscriptions_tenant_user_unique",
    ).on(table.tenantId, table.userId),
    customerUnique: uniqueIndex("idx_account_subscriptions_customer_unique").on(
      table.stripeCustomerId,
    ),
    subscriptionUnique: uniqueIndex(
      "idx_account_subscriptions_subscription_unique",
    ).on(table.stripeSubscriptionId),
  }),
);

export const HOSTED_USAGE_RESERVATION_STATUSES = [
  "reserved",
  "settled",
  "refunded",
] as const;

export const hostedUsageCounters = sqliteTable(
  "hosted_usage_counters",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    action: text("action", { enum: HOSTED_USAGE_ACTIONS }).notNull(),
    usedUnits: integer("used_units").notNull().default(0),
    reservedUnits: integer("reserved_units").notNull().default(0),
    limitUnits: integer("limit_units").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserPeriodActionUnique: uniqueIndex(
      "idx_hosted_usage_counters_tenant_user_period_action_unique",
    ).on(table.tenantId, table.userId, table.period, table.action),
    tenantUserPeriodIndex: index(
      "idx_hosted_usage_counters_tenant_user_period",
    ).on(table.tenantId, table.userId, table.period),
  }),
);

export const hostedUsageReservations = sqliteTable(
  "hosted_usage_reservations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    action: text("action", { enum: HOSTED_USAGE_ACTIONS }).notNull(),
    reservedUnits: integer("reserved_units").notNull(),
    usedUnits: integer("used_units").notNull().default(0),
    refundedUnits: integer("refunded_units").notNull().default(0),
    status: text("status", {
      enum: HOSTED_USAGE_RESERVATION_STATUSES,
    })
      .notNull()
      .default("reserved"),
    idempotencyKey: text("idempotency_key"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserPeriodIndex: index(
      "idx_hosted_usage_reservations_tenant_user_period",
    ).on(table.tenantId, table.userId, table.period),
    tenantUserPeriodActionIdempotencyUnique: uniqueIndex(
      "idx_hosted_usage_reservations_idempotency_unique",
    ).on(
      table.tenantId,
      table.userId,
      table.period,
      table.action,
      table.idempotencyKey,
    ),
  }),
);

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),

    // From crawler
    source: text("source").notNull().default("gradcracker"),
    sourceJobId: text("source_job_id"),
    jobUrlDirect: text("job_url_direct"),
    datePosted: text("date_posted"),
    title: text("title").notNull(),
    employer: text("employer").notNull(),
    employerUrl: text("employer_url"),
    jobUrl: text("job_url").notNull(),
    applicationLink: text("application_link"),
    disciplines: text("disciplines"),
    deadline: text("deadline"),
    salary: text("salary"),
    location: text("location"),
    locationEvidence: text("location_evidence"),
    degreeRequired: text("degree_required"),
    starting: text("starting"),
    jobDescription: text("job_description"),

    // JobSpy fields (nullable for other sources)
    jobType: text("job_type"),
    salarySource: text("salary_source"),
    salaryInterval: text("salary_interval"),
    salaryMinAmount: real("salary_min_amount"),
    salaryMaxAmount: real("salary_max_amount"),
    salaryCurrency: text("salary_currency"),
    isRemote: integer("is_remote", { mode: "boolean" }),
    jobLevel: text("job_level"),
    jobFunction: text("job_function"),
    listingType: text("listing_type"),
    emails: text("emails"),
    companyIndustry: text("company_industry"),
    companyLogo: text("company_logo"),
    companyUrlDirect: text("company_url_direct"),
    companyAddresses: text("company_addresses"),
    companyNumEmployees: text("company_num_employees"),
    companyRevenue: text("company_revenue"),
    companyDescription: text("company_description"),
    skills: text("skills"),
    experienceRange: text("experience_range"),
    companyRating: real("company_rating"),
    companyReviewsCount: integer("company_reviews_count"),
    vacancyCount: integer("vacancy_count"),
    workFromHomeType: text("work_from_home_type"),

    // Orchestrator enrichments
    status: text("status", {
      enum: [
        "discovered",
        "processing",
        "ready",
        "applied",
        "in_progress",
        "skipped",
        "expired",
      ],
    })
      .notNull()
      .default("discovered"),
    outcome: text("outcome", { enum: APPLICATION_OUTCOMES }),
    closedAt: integer("closed_at", { mode: "number" }),
    suitabilityScore: real("suitability_score"),
    suitabilityReason: text("suitability_reason"),
    jobBrief: text("job_brief"),
    tailoredSummary: text("tailored_summary"),
    tailoredHeadline: text("tailored_headline"),
    tailoredSkills: text("tailored_skills"),
    selectedProjectIds: text("selected_project_ids"),
    pdfPath: text("pdf_path"),
    pdfSource: text("pdf_source", { enum: ["generated", "uploaded"] }),
    pdfRegenerating: integer("pdf_regenerating", { mode: "boolean" })
      .notNull()
      .default(false),
    pdfFingerprint: text("pdf_fingerprint"),
    pdfGeneratedAt: text("pdf_generated_at"),
    tracerLinksEnabled: integer("tracer_links_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    sponsorMatchScore: real("sponsor_match_score"),
    sponsorMatchNames: text("sponsor_match_names"),

    // Timestamps
    discoveredAt: text("discovered_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    processedAt: text("processed_at"),
    readyAt: text("ready_at"),
    appliedAt: text("applied_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserJobUrlUnique: uniqueIndex(
      "idx_jobs_tenant_user_job_url_unique",
    ).on(table.tenantId, sql`coalesce(${table.userId}, '')`, table.jobUrl),
    tenantStatusIndex: index("idx_jobs_tenant_user_status").on(
      table.tenantId,
      table.userId,
      table.status,
    ),
    tenantDiscoveredAtIndex: index("idx_jobs_tenant_discovered_at").on(
      table.tenantId,
      table.discoveredAt,
    ),
  }),
);

export const jobVerifiedFacts = sqliteTable(
  "job_verified_facts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    factKey: text("fact_key", { enum: VERIFIED_JOB_FACT_KEYS }).notNull(),
    evidence: text("evidence", { mode: "json" }).notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserJobFactUnique: uniqueIndex(
      "idx_job_verified_facts_tenant_user_job_fact_unique",
    ).on(
      table.tenantId,
      sql`coalesce(${table.userId}, '')`,
      table.jobId,
      table.factKey,
    ),
    tenantUserJobIndex: index("idx_job_verified_facts_tenant_user_job").on(
      table.tenantId,
      table.userId,
      table.jobId,
    ),
  }),
);

export const jobImmigrationProfiles = sqliteTable(
  "job_immigration_profiles",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    nocCode: text("noc_code"),
    lmiaHistoricalSignal: text("lmia_historical_signal", {
      enum: LMIA_HISTORICAL_SIGNAL_STATUSES,
    })
      .notNull()
      .default("unknown"),
    lmiaLatestQuarter: text("lmia_latest_quarter"),
    lmiaStreams: text("lmia_streams", { mode: "json" })
      .notNull()
      .default(sql`'[]'`),
    lmiaMatchedEmployerNames: text("lmia_matched_employer_names", {
      mode: "json",
    })
      .notNull()
      .default(sql`'[]'`),
    lmiaMatchedRows: integer("lmia_matched_rows").notNull().default(0),
    lmiaSourceUrl: text("lmia_source_url"),
    lmiaSourceDate: text("lmia_source_date"),
    lmiaLastCheckedAt: text("lmia_last_checked_at"),
    employerSupportStatus: text("employer_support_status", {
      enum: IMMIGRATION_EMPLOYER_SUPPORT_STATUSES,
    })
      .notNull()
      .default("unknown"),
    workPermitRequirement: text("work_permit_requirement"),
    usTravelRequired: integer("us_travel_required", { mode: "boolean" }),
    wageHourlyCad: real("wage_hourly_cad"),
    wageAnnualCad: real("wage_annual_cad"),
    immigrationNotes: text("immigration_notes"),
    evidence: text("evidence", { mode: "json" }).notNull().default(sql`'[]'`),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserJobUnique: uniqueIndex(
      "idx_job_immigration_profiles_tenant_user_job_unique",
    ).on(table.tenantId, sql`coalesce(${table.userId}, '')`, table.jobId),
    tenantUserJobIndex: index(
      "idx_job_immigration_profiles_tenant_user_job",
    ).on(table.tenantId, table.userId, table.jobId),
  }),
);

export const humanBridgeCompanies = sqliteTable(
  "human_bridge_companies",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserNameUnique: uniqueIndex(
      "idx_human_bridge_companies_tenant_user_name_unique",
    ).on(
      table.tenantId,
      sql`coalesce(${table.userId}, '')`,
      table.normalizedName,
    ),
  }),
);

export const jobHumanBridgeCompanies = sqliteTable(
  "job_human_bridge_companies",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    companyId: text("company_id")
      .notNull()
      .references(() => humanBridgeCompanies.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserJobUnique: uniqueIndex(
      "idx_job_human_bridge_companies_tenant_user_job_unique",
    ).on(table.tenantId, sql`coalesce(${table.userId}, '')`, table.jobId),
    tenantUserCompanyIndex: index(
      "idx_job_human_bridge_companies_tenant_user_company",
    ).on(table.tenantId, table.userId, table.companyId),
  }),
);

export const humanBridgeContacts = sqliteTable(
  "human_bridge_contacts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    companyId: text("company_id")
      .notNull()
      .references(() => humanBridgeCompanies.id, { onDelete: "cascade" }),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    role: text("role"),
    linkedinUrl: text("linkedin_url"),
    influenceScore: integer("influence_score").notNull().default(0),
    bridgeLevel: text("bridge_level", { enum: HUMAN_BRIDGE_LEVELS })
      .notNull()
      .default("B0"),
    bridgeEvidence: text("bridge_evidence"),
    lastContactAt: integer("last_contact_at", { mode: "number" }),
    outcome: text("outcome"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserCompanyIndex: index(
      "idx_human_bridge_contacts_tenant_user_company",
    ).on(table.tenantId, table.userId, table.companyId),
    tenantUserJobIndex: index("idx_human_bridge_contacts_tenant_user_job").on(
      table.tenantId,
      table.userId,
      table.jobId,
    ),
  }),
);

export const stageEvents = sqliteTable("stage_events", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .default("tenant_default")
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  applicationId: text("application_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  groupId: text("group_id"),
  fromStage: text("from_stage", { enum: APPLICATION_STAGES }),
  toStage: text("to_stage", { enum: APPLICATION_STAGES }).notNull(),
  occurredAt: integer("occurred_at", { mode: "number" }).notNull(),
  metadata: text("metadata", { mode: "json" }),
  outcome: text("outcome", { enum: APPLICATION_OUTCOMES }),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .default("tenant_default")
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  applicationId: text("application_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  type: text("type", { enum: APPLICATION_TASK_TYPES }).notNull(),
  title: text("title").notNull(),
  dueDate: integer("due_date", { mode: "number" }),
  isCompleted: integer("is_completed", { mode: "boolean" })
    .notNull()
    .default(false),
  notes: text("notes"),
});

export const jobNotes = sqliteTable(
  "job_notes",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    jobUpdatedIndex: index("idx_job_notes_job_updated").on(
      table.jobId,
      table.updatedAt,
    ),
  }),
);

export const interviews = sqliteTable("interviews", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .default("tenant_default")
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  applicationId: text("application_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  scheduledAt: integer("scheduled_at", { mode: "number" }).notNull(),
  durationMins: integer("duration_mins"),
  type: text("type", { enum: INTERVIEW_TYPES }).notNull(),
  outcome: text("outcome", { enum: INTERVIEW_OUTCOMES }),
});

export const pipelineRuns = sqliteTable("pipeline_runs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .default("tenant_default")
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  startedAt: text("started_at").notNull().default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
  status: text("status", {
    enum: ["running", "completed", "failed", "cancelled"],
  })
    .notNull()
    .default("running"),
  jobsDiscovered: integer("jobs_discovered").notNull().default(0),
  jobsProcessed: integer("jobs_processed").notNull().default(0),
  errorMessage: text("error_message"),
  configSnapshot: text("config_snapshot"),
  requestedConfig: text("requested_config", { mode: "json" }),
  effectiveConfig: text("effective_config", { mode: "json" }),
  resultSummary: text("result_summary", { mode: "json" }),
});

export const pipelineSourceRuns = sqliteTable(
  "pipeline_source_runs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    pipelineRunId: text("pipeline_run_id")
      .notNull()
      .references(() => pipelineRuns.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    scopeKey: text("scope_key").notNull().default("default"),
    status: text("status", {
      enum: [
        "pending",
        "running",
        "retry",
        "complete",
        "complete_with_fallback",
        "degraded",
        "failed",
      ],
    })
      .notNull()
      .default("pending"),
    checkpoint: text("checkpoint", { mode: "json" }),
    attemptCount: integer("attempt_count").notNull().default(0),
    fallbackSource: text("fallback_source"),
    coverageExpected: integer("coverage_expected"),
    coverageCompleted: integer("coverage_completed").notNull().default(0),
    errorMessage: text("error_message"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    runStatusIndex: index("idx_pipeline_source_runs_run_status").on(
      table.pipelineRunId,
      table.status,
    ),
    sourceStatusIndex: index("idx_pipeline_source_runs_source_status").on(
      table.source,
      table.status,
    ),
    runSourceScopeUnique: uniqueIndex(
      "idx_pipeline_source_runs_run_source_scope_unique",
    ).on(table.tenantId, table.pipelineRunId, table.source, table.scopeKey),
  }),
);

export const pipelineRunItems = sqliteTable(
  "pipeline_run_items",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    pipelineRunId: text("pipeline_run_id")
      .notNull()
      .references(() => pipelineRuns.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    sourceRunId: text("source_run_id").references(() => pipelineSourceRuns.id, {
      onDelete: "set null",
    }),
    stage: text("stage", {
      enum: [
        "discovered",
        "imported",
        "prefiltered",
        "scored",
        "selected",
        "processed",
      ],
    })
      .notNull()
      .default("discovered"),
    status: text("status", {
      enum: [
        "pending",
        "running",
        "complete",
        "skipped",
        "failed_retryable",
        "failed_terminal",
      ],
    })
      .notNull()
      .default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    runJobUnique: uniqueIndex("idx_pipeline_run_items_run_job_unique").on(
      table.tenantId,
      table.pipelineRunId,
      table.jobId,
    ),
    runStageStatusIndex: index("idx_pipeline_run_items_run_stage_status").on(
      table.pipelineRunId,
      table.stage,
      table.status,
    ),
    jobIndex: index("idx_pipeline_run_items_job").on(table.jobId),
  }),
);

export const pipelineIssues = sqliteTable(
  "pipeline_issues",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    issueSignature: text("issue_signature").notNull(),
    source: text("source").notNull(),
    issueType: text("issue_type").notNull(),
    status: text("status", { enum: ["new", "recurring", "resolved"] })
      .notNull()
      .default("new"),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    occurrenceCount: integer("occurrence_count").notNull().default(1),
    lastError: text("last_error"),
    resolution: text("resolution"),
    resolvedAt: text("resolved_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    signatureUnique: uniqueIndex(
      "idx_pipeline_issues_tenant_signature_unique",
    ).on(table.tenantId, table.issueSignature),
    sourceStatusIndex: index("idx_pipeline_issues_source_status").on(
      table.source,
      table.status,
    ),
    lastSeenIndex: index("idx_pipeline_issues_last_seen").on(table.lastSeenAt),
  }),
);

export const pipelineIssueOccurrences = sqliteTable(
  "pipeline_issue_occurrences",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    issueId: text("issue_id")
      .notNull()
      .references(() => pipelineIssues.id, { onDelete: "cascade" }),
    pipelineRunId: text("pipeline_run_id").references(() => pipelineRuns.id, {
      onDelete: "set null",
    }),
    sourceRunId: text("source_run_id").references(() => pipelineSourceRuns.id, {
      onDelete: "set null",
    }),
    occurredAt: text("occurred_at").notNull(),
    stage: text("stage"),
    errorMessage: text("error_message"),
    attemptCount: integer("attempt_count").notNull().default(1),
    fallbackUsed: text("fallback_used"),
    recovered: integer("recovered", { mode: "boolean" })
      .notNull()
      .default(false),
    recoveryTimeMs: integer("recovery_time_ms"),
    coverageImpact: real("coverage_impact"),
    metadata: text("metadata", { mode: "json" }),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    issueTimeIndex: index("idx_pipeline_issue_occurrences_issue_time").on(
      table.issueId,
      table.occurredAt,
    ),
    runIndex: index("idx_pipeline_issue_occurrences_run").on(
      table.pipelineRunId,
    ),
  }),
);

export const pipelineSearchPresets = sqliteTable(
  "pipeline_search_presets",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    config: text("config", { mode: "json" }).notNull(),
    lastUsedAt: text("last_used_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserNameUnique: uniqueIndex(
      "idx_pipeline_search_presets_tenant_user_name_unique",
    ).on(table.tenantId, table.userId, table.name),
    tenantUserUpdatedIndex: index(
      "idx_pipeline_search_presets_tenant_user_updated",
    ).on(table.tenantId, table.userId, table.updatedAt),
  }),
);

export const jobChatThreads = sqliteTable(
  "job_chat_threads",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    title: text("title"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
    lastMessageAt: text("last_message_at"),
    activeRootMessageId: text("active_root_message_id"),
    selectedNoteIds: text("selected_note_ids").notNull().default("[]"),
    selectedEmailIds: text("selected_email_ids").notNull().default("[]"),
    selectedDocumentIds: text("selected_document_ids").notNull().default("[]"),
  },
  (table) => ({
    jobUpdatedIndex: index("idx_job_chat_threads_job_updated").on(
      table.jobId,
      table.updatedAt,
    ),
  }),
);

export const jobChatMessages = sqliteTable(
  "job_chat_messages",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    threadId: text("thread_id")
      .notNull()
      .references(() => jobChatThreads.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    role: text("role", { enum: JOB_CHAT_MESSAGE_ROLES }).notNull(),
    content: text("content").notNull().default(""),
    status: text("status", { enum: JOB_CHAT_MESSAGE_STATUSES })
      .notNull()
      .default("partial"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    version: integer("version").notNull().default(1),
    replacesMessageId: text("replaces_message_id"),
    parentMessageId: text("parent_message_id"),
    activeChildId: text("active_child_id"),
    attachments: text("attachments").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    threadCreatedIndex: index("idx_job_chat_messages_thread_created").on(
      table.threadId,
      table.createdAt,
    ),
  }),
);

export const jobChatRuns = sqliteTable(
  "job_chat_runs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    threadId: text("thread_id")
      .notNull()
      .references(() => jobChatThreads.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    status: text("status", { enum: JOB_CHAT_RUN_STATUSES })
      .notNull()
      .default("running"),
    model: text("model"),
    provider: text("provider"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: integer("started_at", { mode: "number" }).notNull(),
    completedAt: integer("completed_at", { mode: "number" }),
    requestId: text("request_id"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    threadStatusIndex: index("idx_job_chat_runs_thread_status").on(
      table.threadId,
      table.status,
    ),
  }),
);

export const settings = sqliteTable(
  "settings",
  {
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserKeyUnique: uniqueIndex("idx_settings_tenant_user_key_unique").on(
      table.tenantId,
      sql`coalesce(${table.userId}, '')`,
      table.key,
    ),
  }),
);

export const watchlistJobStates = sqliteTable(
  "watchlist_job_states",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    source: text("source").notNull(),
    sourceJobId: text("source_job_id").notNull(),
    state: text("state", { enum: ["ignored", "moved_to_workspace"] })
      .notNull()
      .default("ignored"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserSourceJobUnique: uniqueIndex(
      "idx_watchlist_job_states_tenant_user_source_job_unique",
    ).on(table.tenantId, table.userId, table.source, table.sourceJobId),
    tenantUserStateIndex: index(
      "idx_watchlist_job_states_tenant_user_state",
    ).on(table.tenantId, table.userId, table.state),
  }),
);

export const watchlistChecks = sqliteTable(
  "watchlist_checks",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    lastCheckedAt: text("last_checked_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserUnique: uniqueIndex("idx_watchlist_checks_tenant_user_unique").on(
      table.tenantId,
      table.userId,
    ),
  }),
);

export const watchlistSeenJobs = sqliteTable(
  "watchlist_seen_jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    source: text("source").notNull(),
    sourceJobId: text("source_job_id").notNull(),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserSourceJobUnique: uniqueIndex(
      "idx_watchlist_seen_jobs_tenant_user_source_job_unique",
    ).on(table.tenantId, table.userId, table.source, table.sourceJobId),
    tenantUserLastSeenIndex: index(
      "idx_watchlist_seen_jobs_tenant_user_last_seen",
    ).on(table.tenantId, table.userId, table.lastSeenAt),
  }),
);

export const watchlistSelectedSources = sqliteTable(
  "watchlist_selected_sources",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    catalogSourceId: text("catalog_source_id"),
    label: text("label").notNull(),
    careersUrl: text("careers_url").notNull(),
    cxsJobsUrl: text("cxs_jobs_url"),
    sourceType: text("source_type").notNull(),
    isCustom: integer("is_custom", { mode: "boolean" })
      .notNull()
      .default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserSortOrderUnique: uniqueIndex(
      "idx_watchlist_selected_sources_tenant_user_sort_order",
    ).on(table.tenantId, table.userId, table.sortOrder),
    tenantUserCareersUrlUnique: uniqueIndex(
      "idx_watchlist_selected_sources_tenant_user_careers_url",
    ).on(table.tenantId, table.userId, table.careersUrl),
    tenantUserIndex: index("idx_watchlist_selected_sources_tenant_user").on(
      table.tenantId,
      table.userId,
    ),
  }),
);

export const dynamicEmployers = sqliteTable(
  "dynamic_employers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    normalizedName: text("normalized_name").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status", { enum: DYNAMIC_EMPLOYER_STATUSES })
      .notNull()
      .default("discovered"),
    sourceType: text("source_type"),
    careersUrl: text("careers_url"),
    firstSeenSource: text("first_seen_source"),
    firstSeenJobUrl: text("first_seen_job_url"),
    lastSeenSource: text("last_seen_source"),
    lastSeenJobUrl: text("last_seen_job_url"),
    observationCount: integer("observation_count").notNull().default(1),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    activatedAt: text("activated_at"),
    retiredAt: text("retired_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserNameUnique: uniqueIndex(
      "idx_dynamic_employers_tenant_user_name_unique",
    ).on(table.tenantId, table.userId, table.normalizedName),
    tenantUserStatusIndex: index("idx_dynamic_employers_tenant_user_status").on(
      table.tenantId,
      table.userId,
      table.status,
    ),
  }),
);

export const dynamicEmployerEvents = sqliteTable(
  "dynamic_employer_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    employerId: text("employer_id")
      .notNull()
      .references(() => dynamicEmployers.id, { onDelete: "cascade" }),
    eventType: text("event_type", {
      enum: DYNAMIC_EMPLOYER_EVENT_TYPES,
    }).notNull(),
    fromStatus: text("from_status", { enum: DYNAMIC_EMPLOYER_STATUSES }),
    toStatus: text("to_status", { enum: DYNAMIC_EMPLOYER_STATUSES }).notNull(),
    discoverySource: text("discovery_source"),
    jobUrl: text("job_url"),
    sourceType: text("source_type"),
    careersUrl: text("careers_url"),
    note: text("note"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    employerCreatedIndex: index(
      "idx_dynamic_employer_events_employer_created",
    ).on(table.employerId, table.createdAt),
    tenantUserIndex: index("idx_dynamic_employer_events_tenant_user").on(
      table.tenantId,
      table.userId,
    ),
  }),
);

export const analyticsInstallState = sqliteTable("analytics_install_state", {
  id: text("id").primaryKey(),
  distinctId: text("distinct_id").notNull(),
  installedAt: text("installed_at").notNull(),
  rawEventReplayVersion: integer("raw_event_replay_version")
    .notNull()
    .default(0),
  rawEventReplayCompletedAt: text("raw_event_replay_completed_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const analyticsMilestones = sqliteTable(
  "analytics_milestones",
  {
    milestone: text("milestone").primaryKey(),
    firstSeenAt: integer("first_seen_at", { mode: "number" }).notNull(),
    firstSessionId: text("first_session_id"),
    reportedAt: text("reported_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    firstSeenAtIndex: index("idx_analytics_milestones_first_seen_at").on(
      table.firstSeenAt,
    ),
  }),
);

export const analyticsServerEventReplays = sqliteTable(
  "analytics_server_event_replays",
  {
    eventKey: text("event_key").primaryKey(),
    eventName: text("event_name").notNull(),
    occurredAt: integer("occurred_at", { mode: "number" }).notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    claimedAt: integer("claimed_at", { mode: "number" }),
    reportedAt: integer("reported_at", { mode: "number" }),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    eventNameIndex: index("idx_analytics_server_event_replays_event_name").on(
      table.eventName,
    ),
    occurredAtIndex: index("idx_analytics_server_event_replays_occurred_at").on(
      table.occurredAt,
    ),
  }),
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    subject: text("subject").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "number" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "number" }),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    expiresAtIndex: index("idx_auth_sessions_expires_at").on(table.expiresAt),
    revokedAtIndex: index("idx_auth_sessions_revoked_at").on(table.revokedAt),
  }),
);

export const candidateProfileVersions = sqliteTable(
  "candidate_profile_versions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status", { enum: ["draft", "active", "superseded"] })
      .notNull()
      .default("draft"),
    profileJson: text("profile_json", { mode: "json" }).notNull(),
    source: text("source", {
      enum: [
        "design_resume",
        "rxresume",
        "upload",
        "connected_profile",
        "manual",
        "ai_normalized",
      ],
    }).notNull(),
    sourceRef: text("source_ref"),
    provenance: text("provenance", { mode: "json" }),
    activatedAt: text("activated_at"),
    supersededAt: text("superseded_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserVersionUnique: uniqueIndex(
      "idx_candidate_profile_versions_tenant_user_version_unique",
    ).on(
      table.tenantId,
      sql`coalesce(${table.userId}, '')`,
      table.version,
    ),
    tenantUserStatusIndex: index(
      "idx_candidate_profile_versions_tenant_user_status",
    ).on(table.tenantId, table.userId, table.status),
    oneActivePerOwner: uniqueIndex(
      "idx_candidate_profile_versions_one_active_per_owner",
    )
      .on(table.tenantId, sql`coalesce(${table.userId}, '')`)
      .where(sql`${table.status} = 'active'`),
  }),
);

export const candidateStrategyVersions = sqliteTable(
  "candidate_strategy_versions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status", { enum: ["draft", "active", "superseded"] })
      .notNull()
      .default("draft"),
    targetMarkets: text("target_markets", { mode: "json" })
      .notNull()
      .default(sql`'[]'`),
    targetRoleFamilies: text("target_role_families", { mode: "json" })
      .notNull()
      .default(sql`'[]'`),
    excludedRoleFamilies: text("excluded_role_families", { mode: "json" })
      .notNull()
      .default(sql`'[]'`),
    constraints: text("constraints", { mode: "json" })
      .notNull()
      .default(sql`'[]'`),
    freeformNotes: text("freeform_notes"),
    activatedAt: text("activated_at"),
    supersededAt: text("superseded_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserVersionUnique: uniqueIndex(
      "idx_candidate_strategy_versions_tenant_user_version_unique",
    ).on(
      table.tenantId,
      sql`coalesce(${table.userId}, '')`,
      table.version,
    ),
    tenantUserStatusIndex: index(
      "idx_candidate_strategy_versions_tenant_user_status",
    ).on(table.tenantId, table.userId, table.status),
    oneActivePerOwner: uniqueIndex(
      "idx_candidate_strategy_versions_one_active_per_owner",
    )
      .on(table.tenantId, sql`coalesce(${table.userId}, '')`)
      .where(sql`${table.status} = 'active'`),
  }),
);

export const designResumeDocuments = sqliteTable("design_resume_documents", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .default("tenant_default")
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  resumeJson: text("resume_json", { mode: "json" }).notNull(),
  revision: integer("revision").notNull().default(1),
  sourceResumeId: text("source_resume_id"),
  sourceMode: text("source_mode"),
  importedAt: text("imported_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const designResumeAssets = sqliteTable(
  "design_resume_assets",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    documentId: text("document_id")
      .notNull()
      .references(() => designResumeDocuments.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["picture"] })
      .notNull()
      .default("picture"),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    storagePath: text("storage_path").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    documentIndex: index("idx_design_resume_assets_document_id").on(
      table.documentId,
    ),
  }),
);

export const jobDocuments = sqliteTable(
  "job_documents",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mediaType: text("media_type"),
    byteSize: integer("byte_size").notNull(),
    storagePath: text("storage_path").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    jobIndex: index("idx_job_documents_job_id").on(table.jobId),
    tenantJobIndex: index("idx_job_documents_tenant_job_id").on(
      table.tenantId,
      table.jobId,
    ),
  }),
);

export const credentialSecrets = sqliteTable(
  "credential_secrets",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    ownerType: text("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
    secretName: text("secret_name").notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    keyVersion: text("key_version").notNull().default("v1"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    ownerSecretUnique: uniqueIndex(
      "idx_credential_secrets_owner_unique",
    ).on(
      table.tenantId,
      sql`coalesce(${table.userId}, '')`,
      table.ownerType,
      table.ownerId,
      table.secretName,
    ),
    ownerIndex: index("idx_credential_secrets_owner").on(
      table.ownerType,
      table.ownerId,
    ),
  }),
);

export const postApplicationIntegrations = sqliteTable(
  "post_application_integrations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    provider: text("provider", { enum: POST_APPLICATION_PROVIDERS }).notNull(),
    accountKey: text("account_key").notNull().default("default"),
    displayName: text("display_name"),
    status: text("status", { enum: POST_APPLICATION_INTEGRATION_STATUSES })
      .notNull()
      .default("disconnected"),
    credentials: text("credentials", { mode: "json" }),
    lastConnectedAt: integer("last_connected_at", { mode: "number" }),
    lastSyncedAt: integer("last_synced_at", { mode: "number" }),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    providerAccountUnique: uniqueIndex(
      "idx_post_app_integrations_tenant_user_provider_account_unique",
    ).on(
      table.tenantId,
      sql`coalesce(${table.userId}, '')`,
      table.provider,
      table.accountKey,
    ),
  }),
);

export const postApplicationSyncRuns = sqliteTable(
  "post_application_sync_runs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    provider: text("provider", { enum: POST_APPLICATION_PROVIDERS }).notNull(),
    accountKey: text("account_key").notNull().default("default"),
    integrationId: text("integration_id").references(
      () => postApplicationIntegrations.id,
      { onDelete: "set null" },
    ),
    status: text("status", { enum: POST_APPLICATION_SYNC_RUN_STATUSES })
      .notNull()
      .default("running"),
    startedAt: integer("started_at", { mode: "number" }).notNull(),
    completedAt: integer("completed_at", { mode: "number" }),
    messagesDiscovered: integer("messages_discovered").notNull().default(0),
    messagesRelevant: integer("messages_relevant").notNull().default(0),
    messagesClassified: integer("messages_classified").notNull().default(0),
    messagesMatched: integer("messages_matched").notNull().default(0),
    messagesApproved: integer("messages_approved").notNull().default(0),
    messagesDenied: integer("messages_denied").notNull().default(0),
    messagesErrored: integer("messages_errored").notNull().default(0),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    providerAccountStartedAtIndex: index(
      "idx_post_app_sync_runs_provider_account_started_at",
    ).on(table.provider, table.accountKey, table.startedAt),
  }),
);

export const postApplicationMessages = sqliteTable(
  "post_application_messages",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    provider: text("provider", { enum: POST_APPLICATION_PROVIDERS }).notNull(),
    accountKey: text("account_key").notNull().default("default"),
    integrationId: text("integration_id").references(
      () => postApplicationIntegrations.id,
      { onDelete: "set null" },
    ),
    syncRunId: text("sync_run_id").references(
      () => postApplicationSyncRuns.id,
      {
        onDelete: "set null",
      },
    ),
    externalMessageId: text("external_message_id").notNull(),
    externalThreadId: text("external_thread_id"),
    fromAddress: text("from_address").notNull().default(""),
    fromDomain: text("from_domain"),
    senderName: text("sender_name"),
    subject: text("subject").notNull().default(""),
    receivedAt: integer("received_at", { mode: "number" }).notNull(),
    snippet: text("snippet").notNull().default(""),
    classificationLabel: text("classification_label"),
    classificationConfidence: real("classification_confidence"),
    classificationPayload: text("classification_payload", { mode: "json" }),
    relevanceLlmScore: real("relevance_llm_score"),
    relevanceDecision: text("relevance_decision", {
      enum: POST_APPLICATION_RELEVANCE_DECISIONS,
    })
      .notNull()
      .default("needs_llm"),
    matchConfidence: integer("match_confidence"),
    messageType: text("message_type", {
      enum: POST_APPLICATION_MESSAGE_TYPES,
    })
      .notNull()
      .default("other"),
    stageEventPayload: text("stage_event_payload", { mode: "json" }),
    processingStatus: text("processing_status", {
      enum: POST_APPLICATION_PROCESSING_STATUSES,
    })
      .notNull()
      .default("pending_user"),
    matchedJobId: text("matched_job_id").references(() => jobs.id, {
      onDelete: "set null",
    }),
    decidedAt: integer("decided_at", { mode: "number" }),
    decidedBy: text("decided_by"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    providerAccountExternalMessageUnique: uniqueIndex(
      "idx_post_app_messages_tenant_user_provider_account_external_unique",
    ).on(
      table.tenantId,
      sql`coalesce(${table.userId}, '')`,
      table.provider,
      table.accountKey,
      table.externalMessageId,
    ),
    providerAccountReviewStatusIndex: index(
      "idx_post_app_messages_provider_account_processing_status",
    ).on(table.provider, table.accountKey, table.processingStatus),
  }),
);

export const tracerLinks = sqliteTable(
  "tracer_links",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    token: text("token").notNull().unique(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    sourcePath: text("source_path").notNull(),
    sourceLabel: text("source_label").notNull(),
    destinationUrl: text("destination_url").notNull(),
    destinationUrlHash: text("destination_url_hash").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    jobPathDestinationUnique: uniqueIndex(
      "idx_tracer_links_tenant_user_job_source_destination_unique",
    ).on(
      table.tenantId,
      sql`coalesce(${table.userId}, '')`,
      table.jobId,
      table.sourcePath,
      table.destinationUrlHash,
    ),
    jobIndex: index("idx_tracer_links_job_id").on(table.jobId),
  }),
);

export const tracerClickEvents = sqliteTable(
  "tracer_click_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    tracerLinkId: text("tracer_link_id")
      .notNull()
      .references(() => tracerLinks.id, { onDelete: "cascade" }),
    clickedAt: integer("clicked_at", { mode: "number" }).notNull(),
    requestId: text("request_id"),
    isLikelyBot: integer("is_likely_bot", { mode: "boolean" })
      .notNull()
      .default(false),
    deviceType: text("device_type").notNull().default("unknown"),
    uaFamily: text("ua_family").notNull().default("unknown"),
    osFamily: text("os_family").notNull().default("unknown"),
    referrerHost: text("referrer_host"),
    ipHash: text("ip_hash"),
    uniqueFingerprintHash: text("unique_fingerprint_hash"),
  },
  (table) => ({
    tracerLinkIndex: index("idx_tracer_click_events_tracer_link_id").on(
      table.tracerLinkId,
    ),
    clickedAtIndex: index("idx_tracer_click_events_clicked_at").on(
      table.clickedAt,
    ),
    botIndex: index("idx_tracer_click_events_is_likely_bot").on(
      table.isLikelyBot,
    ),
    uniqueFingerprintIndex: index(
      "idx_tracer_click_events_unique_fingerprint_hash",
    ).on(table.uniqueFingerprintHash),
  }),
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type TenantRow = typeof tenants.$inferSelect;
export type NewTenantRow = typeof tenants.$inferInsert;
export type TenantMembershipRow = typeof tenantMemberships.$inferSelect;
export type NewTenantMembershipRow = typeof tenantMemberships.$inferInsert;
export type HostedUsageCounterRow = typeof hostedUsageCounters.$inferSelect;
export type NewHostedUsageCounterRow = typeof hostedUsageCounters.$inferInsert;
export type HostedUsageReservationRow =
  typeof hostedUsageReservations.$inferSelect;
export type NewHostedUsageReservationRow =
  typeof hostedUsageReservations.$inferInsert;
export type JobRow = typeof jobs.$inferSelect;
export type NewJobRow = typeof jobs.$inferInsert;
export type JobVerifiedFactRow = typeof jobVerifiedFacts.$inferSelect;
export type NewJobVerifiedFactRow = typeof jobVerifiedFacts.$inferInsert;
export type JobImmigrationProfileRow =
  typeof jobImmigrationProfiles.$inferSelect;
export type NewJobImmigrationProfileRow =
  typeof jobImmigrationProfiles.$inferInsert;
export type StageEventRow = typeof stageEvents.$inferSelect;
export type NewStageEventRow = typeof stageEvents.$inferInsert;
export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;
export type JobNoteRow = typeof jobNotes.$inferSelect;
export type NewJobNoteRow = typeof jobNotes.$inferInsert;
export type JobDocumentRow = typeof jobDocuments.$inferSelect;
export type NewJobDocumentRow = typeof jobDocuments.$inferInsert;
export type InterviewRow = typeof interviews.$inferSelect;
export type NewInterviewRow = typeof interviews.$inferInsert;
export type PipelineRunRow = typeof pipelineRuns.$inferSelect;
export type NewPipelineRunRow = typeof pipelineRuns.$inferInsert;
export type PipelineRunItemRow = typeof pipelineRunItems.$inferSelect;
export type NewPipelineRunItemRow = typeof pipelineRunItems.$inferInsert;
export type PipelineSourceRunRow = typeof pipelineSourceRuns.$inferSelect;
export type NewPipelineSourceRunRow = typeof pipelineSourceRuns.$inferInsert;
export type PipelineIssueRow = typeof pipelineIssues.$inferSelect;
export type NewPipelineIssueRow = typeof pipelineIssues.$inferInsert;
export type PipelineIssueOccurrenceRow =
  typeof pipelineIssueOccurrences.$inferSelect;
export type NewPipelineIssueOccurrenceRow =
  typeof pipelineIssueOccurrences.$inferInsert;
export type PipelineSearchPresetRow = typeof pipelineSearchPresets.$inferSelect;
export type NewPipelineSearchPresetRow =
  typeof pipelineSearchPresets.$inferInsert;
export type JobChatThreadRow = typeof jobChatThreads.$inferSelect;
export type NewJobChatThreadRow = typeof jobChatThreads.$inferInsert;
export type JobChatMessageRow = typeof jobChatMessages.$inferSelect;
export type NewJobChatMessageRow = typeof jobChatMessages.$inferInsert;
export type JobChatRunRow = typeof jobChatRuns.$inferSelect;
export type NewJobChatRunRow = typeof jobChatRuns.$inferInsert;
export type SettingsRow = typeof settings.$inferSelect;
export type NewSettingsRow = typeof settings.$inferInsert;
export type AnalyticsInstallStateRow =
  typeof analyticsInstallState.$inferSelect;
export type NewAnalyticsInstallStateRow =
  typeof analyticsInstallState.$inferInsert;
export type AnalyticsMilestoneRow = typeof analyticsMilestones.$inferSelect;
export type NewAnalyticsMilestoneRow = typeof analyticsMilestones.$inferInsert;
export type AnalyticsServerEventReplayRow =
  typeof analyticsServerEventReplays.$inferSelect;
export type NewAnalyticsServerEventReplayRow =
  typeof analyticsServerEventReplays.$inferInsert;
export type CandidateProfileVersionRow =
  typeof candidateProfileVersions.$inferSelect;
export type NewCandidateProfileVersionRow =
  typeof candidateProfileVersions.$inferInsert;
export type CandidateStrategyVersionRow =
  typeof candidateStrategyVersions.$inferSelect;
export type NewCandidateStrategyVersionRow =
  typeof candidateStrategyVersions.$inferInsert;
export type DesignResumeDocumentRow = typeof designResumeDocuments.$inferSelect;
export type NewDesignResumeDocumentRow =
  typeof designResumeDocuments.$inferInsert;
export type DesignResumeAssetRow = typeof designResumeAssets.$inferSelect;
export type NewDesignResumeAssetRow = typeof designResumeAssets.$inferInsert;
export type CredentialSecretRow = typeof credentialSecrets.$inferSelect;
export type NewCredentialSecretRow = typeof credentialSecrets.$inferInsert;
export type PostApplicationIntegrationRow =
  typeof postApplicationIntegrations.$inferSelect;
export type NewPostApplicationIntegrationRow =
  typeof postApplicationIntegrations.$inferInsert;
export type PostApplicationSyncRunRow =
  typeof postApplicationSyncRuns.$inferSelect;
export type NewPostApplicationSyncRunRow =
  typeof postApplicationSyncRuns.$inferInsert;
export type PostApplicationMessageRow =
  typeof postApplicationMessages.$inferSelect;
export type NewPostApplicationMessageRow =
  typeof postApplicationMessages.$inferInsert;
export type TracerLinkRow = typeof tracerLinks.$inferSelect;
export type NewTracerLinkRow = typeof tracerLinks.$inferInsert;
export type TracerClickEventRow = typeof tracerClickEvents.$inferSelect;
export type NewTracerClickEventRow = typeof tracerClickEvents.$inferInsert;
