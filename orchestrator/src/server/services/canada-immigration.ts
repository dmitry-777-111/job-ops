import type {
  JobImmigrationProfile,
  LmiaHistoricalSignalStatus,
  VisaSponsor,
} from "@shared/types";
import {
  getOrganizationDetails,
  getStatus,
  searchSponsorsExact,
} from "./visa-sponsors";

export const CANADA_LMIA_DATASET_URL =
  "https://open.canada.ca/data/en/dataset/90fed587-1364-4f33-a9ee-208181dc0b97";

type LmiaHistory = Pick<
  JobImmigrationProfile,
  | "lmiaHistoricalSignal"
  | "lmiaLatestQuarter"
  | "lmiaStreams"
  | "lmiaMatchedEmployerNames"
  | "lmiaMatchedRows"
  | "lmiaSourceUrl"
  | "lmiaSourceDate"
  | "lmiaLastCheckedAt"
>;

function quarterFromRow(row: VisaSponsor): string | null {
  return /\((\d{4}Q[1-4])(?:[:)])/i.exec(row.typeRating)?.[1] ?? null;
}

export function aggregateCanadaLmiaRows(input: {
  matchedNames: string[];
  rows: VisaSponsor[];
  sourceDate: string | null;
  checkedAt: string;
}): LmiaHistory {
  const quarters = input.rows
    .map(quarterFromRow)
    .filter((quarter): quarter is string => Boolean(quarter))
    .sort()
    .reverse();

  return {
    lmiaHistoricalSignal: "matched",
    lmiaLatestQuarter: quarters[0] ?? null,
    lmiaStreams: [
      ...new Set(input.rows.map((row) => row.route).filter(Boolean)),
    ].sort(),
    lmiaMatchedEmployerNames: [...new Set(input.matchedNames)].sort(),
    lmiaMatchedRows: input.rows.length,
    lmiaSourceUrl: CANADA_LMIA_DATASET_URL,
    lmiaSourceDate: input.sourceDate,
    lmiaLastCheckedAt: input.checkedAt,
  };
}

export async function getEmployerLmiaHistory(
  employer: string,
): Promise<LmiaHistory> {
  const checkedAt = new Date().toISOString();
  const exact = await searchSponsorsExact(employer, { countryKey: "canada" });
  const status = await getStatus();
  const caStatus = status.providers.find(
    (provider) => provider.providerId === "ca",
  );
  const base = {
    lmiaSourceUrl: CANADA_LMIA_DATASET_URL,
    lmiaSourceDate: caStatus?.lastUpdated ?? null,
    lmiaLastCheckedAt: checkedAt,
  };

  if (!exact.available || !exact.providerIds.includes("ca")) {
    return {
      ...base,
      lmiaHistoricalSignal: "unknown" as LmiaHistoricalSignalStatus,
      lmiaLatestQuarter: null,
      lmiaStreams: [],
      lmiaMatchedEmployerNames: [],
      lmiaMatchedRows: 0,
    };
  }

  const matchedNames = [
    ...new Set(
      exact.results
        .filter((result) => result.providerId === "ca")
        .map((result) => result.sponsor.organisationName),
    ),
  ];

  if (matchedNames.length === 0) {
    return {
      ...base,
      lmiaHistoricalSignal: "none" as LmiaHistoricalSignalStatus,
      lmiaLatestQuarter: null,
      lmiaStreams: [],
      lmiaMatchedEmployerNames: [],
      lmiaMatchedRows: 0,
    };
  }

  const rows = (
    await Promise.all(
      matchedNames.map((name) => getOrganizationDetails(name, "ca")),
    )
  ).flat();

  return aggregateCanadaLmiaRows({
    matchedNames,
    rows,
    sourceDate: caStatus?.lastUpdated ?? null,
    checkedAt,
  });
}
