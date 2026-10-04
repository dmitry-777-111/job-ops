import { conflict, notFound } from "@infra/errors";
import {
  getApplicationPackage,
  updateApplicationPackage,
} from "@server/repositories/application-packages";
import type { ApplicationPackage } from "@shared/types";
import { evaluateStoredApplicationPackageQa } from "./application-package-approval";

export interface ApplicationPackageExportArtifact {
  fileName: string;
  mediaType: "application/json";
  document: {
    packageId: string;
    packageVersion: number;
    marketPostingId: string;
    marketPostingVersionId: string;
    profileVersionId: string;
    strategyVersionId: string | null;
    generationPolicyVersion: string;
    targetedCvJson: Record<string, unknown> | null;
    coverLetter: string | null;
    formAnswers: Record<string, string>;
    evidenceMap: ApplicationPackage["evidenceMap"];
    gaps: ApplicationPackage["gaps"];
  };
}

function buildExportArtifact(
  applicationPackage: ApplicationPackage,
): ApplicationPackageExportArtifact {
  return {
    fileName: "application-package-v" + applicationPackage.version + ".json",
    mediaType: "application/json",
    document: {
      packageId: applicationPackage.id,
      packageVersion: applicationPackage.version,
      marketPostingId: applicationPackage.marketPostingId,
      marketPostingVersionId: applicationPackage.marketPostingVersionId,
      profileVersionId: applicationPackage.profileVersionId,
      strategyVersionId: applicationPackage.strategyVersionId,
      generationPolicyVersion: applicationPackage.generationPolicyVersion,
      targetedCvJson: applicationPackage.targetedCvJson,
      coverLetter: applicationPackage.coverLetter,
      formAnswers: applicationPackage.formAnswers,
      evidenceMap: applicationPackage.evidenceMap,
      gaps: applicationPackage.gaps,
    },
  };
}

export async function exportApplicationPackage(input: {
  applicationPackageId: string;
  acknowledgeUnknownLiveState?: boolean;
}): Promise<{
  applicationPackage: ApplicationPackage;
  artifact: ApplicationPackageExportArtifact;
}> {
  const existing = await getApplicationPackage(input.applicationPackageId);
  if (!existing) throw notFound("Application package not found.");

  if (existing.status !== "approved" && existing.status !== "exported") {
    throw conflict("Application package must be approved before export.");
  }

  const evaluated = await evaluateStoredApplicationPackageQa(input);
  if (!evaluated.qa.pass) {
    throw conflict(
      "Application package QA failed before export: " +
        evaluated.qa.blockingIssues.join(", "),
    );
  }

  const exported =
    existing.status === "exported"
      ? existing
      : await updateApplicationPackage(input.applicationPackageId, {
          status: "exported",
          staleReason: null,
        });
  if (!exported) throw notFound("Application package not found.");

  return {
    applicationPackage: exported,
    artifact: buildExportArtifact(exported),
  };
}
