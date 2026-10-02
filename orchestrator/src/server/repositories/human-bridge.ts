import { randomUUID } from "node:crypto";
import type {
  CreateHumanBridgeContactInput,
  HumanBridgeCompany,
  HumanBridgeContact,
  JobHumanBridgeContext,
  UpdateHumanBridgeContactInput,
} from "@shared/types";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import {
  getPrivateDataScope,
  privateDataScopeFilter,
} from "../tenancy/private-scope";

const { humanBridgeCompanies, humanBridgeContacts, jobHumanBridgeCompanies } =
  schema;

function companyScope() {
  return privateDataScopeFilter(humanBridgeCompanies);
}

function contactScope() {
  return privateDataScopeFilter(humanBridgeContacts);
}

function jobCompanyScope() {
  return privateDataScopeFilter(jobHumanBridgeCompanies);
}

function normalizeCompanyName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function mapCompany(
  row: typeof humanBridgeCompanies.$inferSelect,
): HumanBridgeCompany {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapContact(
  row: typeof humanBridgeContacts.$inferSelect,
): HumanBridgeContact {
  return {
    id: row.id,
    companyId: row.companyId,
    jobId: row.jobId,
    name: row.name,
    role: row.role,
    linkedinUrl: row.linkedinUrl,
    influenceScore: row.influenceScore,
    bridgeLevel: row.bridgeLevel,
    bridgeEvidence: row.bridgeEvidence,
    lastContactAt: row.lastContactAt,
    outcome: row.outcome,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getLinkedCompany(jobId: string) {
  const [link] = await db
    .select()
    .from(jobHumanBridgeCompanies)
    .where(and(jobCompanyScope(), eq(jobHumanBridgeCompanies.jobId, jobId)));
  if (!link) return null;

  const [company] = await db
    .select()
    .from(humanBridgeCompanies)
    .where(and(companyScope(), eq(humanBridgeCompanies.id, link.companyId)));
  return company ?? null;
}

async function ensureCompany(jobId: string, employerName: string) {
  const linked = await getLinkedCompany(jobId);
  if (linked) return linked;

  const normalizedName = normalizeCompanyName(employerName);
  const [existing] = await db
    .select()
    .from(humanBridgeCompanies)
    .where(
      and(
        companyScope(),
        eq(humanBridgeCompanies.normalizedName, normalizedName),
      ),
    );

  const scope = getPrivateDataScope();
  const now = new Date().toISOString();
  let company = existing;
  if (!company) {
    const [created] = await db
      .insert(humanBridgeCompanies)
      .values({
        id: randomUUID(),
        tenantId: scope.tenantId,
        userId: scope.enforceUserIsolation ? scope.userId : null,
        name: employerName.trim(),
        normalizedName,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    company = created;
  }

  await db
    .insert(jobHumanBridgeCompanies)
    .values({
      id: randomUUID(),
      tenantId: scope.tenantId,
      userId: scope.enforceUserIsolation ? scope.userId : null,
      jobId,
      companyId: company.id,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  const linkedAfterInsert = await getLinkedCompany(jobId);
  if (!linkedAfterInsert) {
    throw new Error("Human Bridge company link could not be created");
  }
  return linkedAfterInsert;
}

async function listContacts(companyId: string): Promise<HumanBridgeContact[]> {
  const rows = await db
    .select()
    .from(humanBridgeContacts)
    .where(and(contactScope(), eq(humanBridgeContacts.companyId, companyId)))
    .orderBy(desc(humanBridgeContacts.updatedAt));
  return rows.map(mapContact);
}

export async function getJobHumanBridgeContext(
  jobId: string,
  employerName: string,
): Promise<JobHumanBridgeContext> {
  const company = await ensureCompany(jobId, employerName);
  return {
    company: mapCompany(company),
    contacts: await listContacts(company.id),
  };
}

export async function createHumanBridgeContact(
  jobId: string,
  employerName: string,
  input: CreateHumanBridgeContactInput,
): Promise<HumanBridgeContact> {
  const company = await ensureCompany(jobId, employerName);
  const scope = getPrivateDataScope();
  const now = new Date().toISOString();
  const [created] = await db
    .insert(humanBridgeContacts)
    .values({
      id: randomUUID(),
      tenantId: scope.tenantId,
      userId: scope.enforceUserIsolation ? scope.userId : null,
      companyId: company.id,
      jobId: input.linkToJob === false ? null : jobId,
      name: input.name.trim(),
      role: input.role ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
      influenceScore: input.influenceScore ?? 0,
      bridgeLevel: input.bridgeLevel ?? "B0",
      bridgeEvidence: input.bridgeEvidence ?? null,
      lastContactAt: input.lastContactAt ?? null,
      outcome: input.outcome ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return mapContact(created);
}

export async function updateHumanBridgeContact(
  jobId: string,
  employerName: string,
  contactId: string,
  input: UpdateHumanBridgeContactInput,
): Promise<HumanBridgeContact | null> {
  const company = await ensureCompany(jobId, employerName);
  const updates: Partial<typeof humanBridgeContacts.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.role !== undefined) updates.role = input.role;
  if (input.linkedinUrl !== undefined) updates.linkedinUrl = input.linkedinUrl;
  if (input.influenceScore !== undefined) {
    updates.influenceScore = input.influenceScore;
  }
  if (input.bridgeLevel !== undefined) updates.bridgeLevel = input.bridgeLevel;
  if (input.bridgeEvidence !== undefined) {
    updates.bridgeEvidence = input.bridgeEvidence;
  }
  if (input.lastContactAt !== undefined) {
    updates.lastContactAt = input.lastContactAt;
  }
  if (input.outcome !== undefined) updates.outcome = input.outcome;
  if (input.linkToJob !== undefined) {
    updates.jobId = input.linkToJob ? jobId : null;
  }

  const [updated] = await db
    .update(humanBridgeContacts)
    .set(updates)
    .where(
      and(
        contactScope(),
        eq(humanBridgeContacts.companyId, company.id),
        eq(humanBridgeContacts.id, contactId),
      ),
    )
    .returning();
  return updated ? mapContact(updated) : null;
}
