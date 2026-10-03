import { randomUUID } from "node:crypto";
import { db, schema } from "@server/db/index";
import * as humanBridgeRepo from "@server/repositories/human-bridge";
import * as immigrationRepo from "@server/repositories/job-immigration-profiles";
import * as factsRepo from "@server/repositories/job-verified-facts";
import * as jobsRepo from "@server/repositories/jobs";
import {
  getStageEvents,
  transitionStage,
} from "@server/services/applicationTracking";
import {
  getPrivateDataScope,
  privateDataScopeFilter,
} from "@server/tenancy/private-scope";
import {
  type APPLICATION_STAGES,
  EVIDENCE_KINDS,
  EVIDENCE_SOURCE_TYPES,
  IMMIGRATION_EMPLOYER_SUPPORT_STATUSES,
  VERIFIED_JOB_FACT_KEYS,
} from "@shared/types";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const evidenceSchema = z
  .object({
    kind: z.enum(EVIDENCE_KINDS),
    sourceType: z.enum(EVIDENCE_SOURCE_TYPES),
    sourceId: z.string().min(1).nullable().optional(),
    sourceUrl: z.string().url().nullable().optional(),
    note: z.string().min(1).max(4000).nullable().optional(),
    verifiedBy: z.literal("user"),
  })
  .strict();

const immigrationEvidenceSchema = z
  .object({
    sourceType: z.enum(EVIDENCE_SOURCE_TYPES),
    sourceId: z.string().min(1).nullable().optional(),
    sourceUrl: z.string().url().nullable().optional(),
    note: z.string().min(1).max(4000),
    verifiedBy: z.literal("user"),
  })
  .strict();

const hardFactSchema = z
  .object({
    factKey: z.enum(VERIFIED_JOB_FACT_KEYS),
    evidence: evidenceSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.evidence.kind !== value.factKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidence", "kind"],
        message: "Hard-fact evidence kind must match the fact key",
      });
    }
  });

const immigrationSchema = z
  .object({
    nocCode: z.string().max(16).nullable().optional(),
    employerSupportStatus: z
      .enum(IMMIGRATION_EMPLOYER_SUPPORT_STATUSES)
      .optional(),
    workPermitRequirement: z.string().max(1000).nullable().optional(),
    usTravelRequired: z.boolean().nullable().optional(),
    wageHourlyCad: z.number().nonnegative().nullable().optional(),
    wageAnnualCad: z.number().nonnegative().nullable().optional(),
    immigrationNotes: z.string().max(4000).nullable().optional(),
    evidence: z.array(immigrationEvidenceSchema).min(1),
  })
  .strict();

const jobSchema = z
  .object({
    legacyId: z.string().min(1).max(200),
    sourceJobId: z.string().max(300).nullable().optional(),
    title: z.string().min(1).max(500),
    employer: z.string().min(1).max(500),
    jobUrl: z.string().url(),
    applicationLink: z.string().url().nullable().optional(),
    location: z.string().max(1000).nullable().optional(),
    salary: z.string().max(1000).nullable().optional(),
    jobDescription: z.string().max(12000).nullable().optional(),
    state: z.enum(["active", "applied", "interview", "rejected"]),
    appliedAt: z.string().datetime({ offset: true }).nullable().optional(),
    applicationEvidence: evidenceSchema.nullable().optional(),
    interviewStage: z
      .enum([
        "recruiter_screen",
        "assessment",
        "hiring_manager_screen",
        "technical_interview",
        "onsite",
      ])
      .nullable()
      .optional(),
    interviewAt: z.number().int().nonnegative().nullable().optional(),
    interviewEvidence: evidenceSchema.nullable().optional(),
    rejectedAt: z.number().int().nonnegative().nullable().optional(),
    rejectionEvidence: evidenceSchema.nullable().optional(),
    nextAction: z.string().min(1).max(1000),
    nextActionReason: z.string().min(1).max(2000),
    hardFacts: z.array(hardFactSchema).default([]),
    immigration: immigrationSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.state !== "active" && !value.applicationEvidence) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["applicationEvidence"],
        message:
          "Verified submission evidence is required for migrated applications",
      });
    }
    if (
      value.applicationEvidence &&
      value.applicationEvidence.kind !== "submission"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["applicationEvidence"],
        message: "Application evidence must be submission evidence",
      });
    }
    if (value.state === "interview") {
      if (!value.interviewStage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["interviewStage"],
          message: "A concrete interview stage is required",
        });
      }
      if (
        !value.interviewEvidence ||
        value.interviewEvidence.kind !== "interview"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["interviewEvidence"],
          message: "Verified interview evidence is required",
        });
      }
    }
    if (
      value.state === "rejected" &&
      (!value.rejectionEvidence || value.rejectionEvidence.kind !== "rejection")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rejectionEvidence"],
        message: "Verified rejection evidence is required",
      });
    }
  });

const contactSchema = z
  .object({
    jobLegacyId: z.string().min(1),
    name: z.string().min(1).max(300),
    role: z.string().max(500).nullable().optional(),
    linkedinUrl: z.string().url().nullable().optional(),
    influenceScore: z.number().int().min(0).max(3).default(0),
    bridgeLevel: z.enum(["B0", "B1", "B2", "B3"]).default("B0"),
    bridgeEvidence: z.string().max(4000).nullable().optional(),
    lastContactAt: z.number().int().nonnegative().nullable().optional(),
    outcome: z.string().max(2000).nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      (value.influenceScore > 0 || value.bridgeLevel !== "B0") &&
      !value.bridgeEvidence?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bridgeEvidence"],
        message: "Positive Human Bridge claims require evidence",
      });
    }
  });

export const legacyCareerOsManifestSchema = z
  .object({
    version: z.literal(1),
    sourceTitle: z.string().min(1),
    sourceUrl: z.string().url(),
    exportedAt: z.string().datetime({ offset: true }),
    jobs: z.array(jobSchema).max(100),
    targetCompanies: z.array(z.string().min(1).max(500)).max(50).default([]),
    contacts: z.array(contactSchema).max(100).default([]),
  })
  .strict();

export type LegacyCareerOsManifest = z.infer<
  typeof legacyCareerOsManifestSchema
>;

export type LegacyCareerOsMigrationSummary = {
  jobsProcessed: number;
  activeJobs: number;
  applications: number;
  interviews: number;
  rejections: number;
  targetCompanies: number;
  contacts: number;
};

const MIGRATION_NOTE_TITLE = "CAREER OS legacy migration";

function normalizeCompanyName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

async function ensureTargetCompany(name: string) {
  const { humanBridgeCompanies } = schema;
  const normalizedName = normalizeCompanyName(name);
  const [existing] = await db
    .select()
    .from(humanBridgeCompanies)
    .where(
      and(
        privateDataScopeFilter(humanBridgeCompanies),
        eq(humanBridgeCompanies.normalizedName, normalizedName),
      ),
    );
  if (existing) return existing.id;

  const scope = getPrivateDataScope();
  const now = new Date().toISOString();
  const [created] = await db
    .insert(humanBridgeCompanies)
    .values({
      id: randomUUID(),
      tenantId: scope.tenantId,
      userId: scope.enforceUserIsolation ? scope.userId : null,
      name: name.trim(),
      normalizedName,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: humanBridgeCompanies.id });
  if (!created) throw new Error("Target company migration failed");
  return created.id;
}

async function upsertMigrationNote(
  jobId: string,
  nextAction: string,
  nextActionReason: string,
  sourceUrl: string,
) {
  const content = [
    `Next action: ${nextAction}`,
    `Why: ${nextActionReason}`,
    `Legacy source: ${sourceUrl}`,
  ].join("\n");
  const notes = await jobsRepo.listJobNotes(jobId);
  const current = notes.find((note) => note.title === MIGRATION_NOTE_TITLE);
  if (current) {
    if (current.content !== content) {
      await jobsRepo.updateJobNote({
        jobId,
        noteId: current.id,
        title: MIGRATION_NOTE_TITLE,
        content,
      });
    }
    return;
  }
  await jobsRepo.createJobNote({
    jobId,
    title: MIGRATION_NOTE_TITLE,
    content,
  });
}

function isoToEpochSeconds(value: string | null | undefined) {
  if (!value) return undefined;
  return Math.floor(new Date(value).getTime() / 1000);
}

async function ensureStage(input: {
  jobId: string;
  stage: (typeof APPLICATION_STAGES)[number];
  occurredAt?: number;
  evidence?: z.infer<typeof evidenceSchema> | null;
  outcome?: "rejected" | null;
  note?: string;
}) {
  const events = await getStageEvents(input.jobId);
  if (
    events.some(
      (event) =>
        event.toStage === input.stage &&
        (event.outcome ?? null) === (input.outcome ?? null),
    )
  )
    return;

  transitionStage(
    input.jobId,
    input.stage,
    input.occurredAt,
    {
      evidence: input.evidence ?? null,
      actor: "user",
      eventType: "status_update",
      note: input.note ?? "Migrated from legacy CAREER OS",
    },
    input.outcome ?? null,
  );
}

export async function migrateLegacyCareerOs(
  rawManifest: unknown,
): Promise<LegacyCareerOsMigrationSummary> {
  const manifest = legacyCareerOsManifestSchema.parse(rawManifest);
  const jobsByLegacyId = new Map<
    string,
    Awaited<ReturnType<typeof jobsRepo.createJob>>
  >();
  const summary: LegacyCareerOsMigrationSummary = {
    jobsProcessed: 0,
    activeJobs: 0,
    applications: 0,
    interviews: 0,
    rejections: 0,
    targetCompanies: 0,
    contacts: 0,
  };

  for (const item of manifest.jobs) {
    const job = await jobsRepo.createJob({
      source: "career_os_legacy",
      sourceJobId: item.sourceJobId ?? item.legacyId,
      title: item.title.trim(),
      employer: item.employer.trim(),
      jobUrl: item.jobUrl,
      applicationLink: item.applicationLink ?? undefined,
      location: item.location ?? undefined,
      salary: item.salary ?? undefined,
      jobDescription: item.jobDescription ?? undefined,
    });
    jobsByLegacyId.set(item.legacyId, job);
    summary.jobsProcessed += 1;

    await upsertMigrationNote(
      job.id,
      item.nextAction,
      item.nextActionReason,
      manifest.sourceUrl,
    );

    if (item.state === "active") {
      summary.activeJobs += 1;
    } else {
      await ensureStage({
        jobId: job.id,
        stage: "applied",
        occurredAt: isoToEpochSeconds(item.appliedAt),
        evidence: item.applicationEvidence,
      });
      summary.applications += 1;
    }

    if (item.interviewStage && item.interviewEvidence) {
      await ensureStage({
        jobId: job.id,
        stage: item.interviewStage!,
        occurredAt: item.interviewAt ?? undefined,
        evidence: item.interviewEvidence,
      });
      summary.interviews += 1;
    }

    if (item.state === "rejected") {
      await ensureStage({
        jobId: job.id,
        stage: "closed",
        occurredAt: item.rejectedAt ?? undefined,
        evidence: item.rejectionEvidence,
        outcome: "rejected",
      });
      summary.rejections += 1;
    }

    for (const fact of item.hardFacts) {
      await factsRepo.upsertJobVerifiedFact({
        jobId: job.id,
        factKey: fact.factKey,
        evidence: fact.evidence,
      });
    }

    if (item.immigration) {
      await immigrationRepo.updateJobImmigrationProfile(
        job.id,
        item.immigration,
      );
    }
  }

  for (const companyName of manifest.targetCompanies) {
    await ensureTargetCompany(companyName);
    summary.targetCompanies += 1;
  }

  for (const contact of manifest.contacts) {
    const job = jobsByLegacyId.get(contact.jobLegacyId);
    if (!job)
      throw new Error(`Unknown contact jobLegacyId: ${contact.jobLegacyId}`);
    const context = await humanBridgeRepo.getJobHumanBridgeContext(
      job.id,
      job.employer,
    );
    const exists = context.contacts.some(
      (existing) =>
        existing.name.trim().toLocaleLowerCase() ===
        contact.name.trim().toLocaleLowerCase(),
    );
    if (!exists) {
      await humanBridgeRepo.createHumanBridgeContact(job.id, job.employer, {
        name: contact.name,
        role: contact.role ?? null,
        linkedinUrl: contact.linkedinUrl ?? null,
        influenceScore: contact.influenceScore,
        bridgeLevel: contact.bridgeLevel,
        bridgeEvidence: contact.bridgeEvidence ?? null,
        lastContactAt: contact.lastContactAt ?? null,
        outcome: contact.outcome ?? null,
        linkToJob: true,
      });
    }
    summary.contacts += 1;
  }

  return summary;
}
