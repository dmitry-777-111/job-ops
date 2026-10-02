import * as api from "@client/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ImmigrationProfilePanel } from "./ImmigrationProfilePanel";

vi.mock("@client/api", () => ({
  getJobImmigrationContext: vi.fn(),
  saveJobImmigrationProfile: vi.fn(),
  refreshJobLmiaHistory: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getJobImmigrationContext).mockResolvedValue({
    profile: {
      jobId: "g3-job",
      nocCode: "72422",
      lmiaHistoricalSignal: "matched",
      lmiaLatestQuarter: "2026Q2",
      lmiaStreams: ["Global Talent Stream", "High-wage"],
      lmiaMatchedEmployerNames: ["Example Industries Inc."],
      lmiaMatchedRows: 3,
      lmiaSourceUrl: "https://open.canada.ca/data/en/dataset/example",
      lmiaSourceDate: "2026-09-30T12:00:00.000Z",
      lmiaLastCheckedAt: "2026-10-02T12:00:00.000Z",
      employerSupportStatus: "possible",
      workPermitRequirement: null,
      usTravelRequired: null,
      wageHourlyCad: 40,
      wageAnnualCad: 83200,
      immigrationNotes: null,
      evidence: [],
      createdAt: "2026-10-02T12:00:00.000Z",
      updatedAt: "2026-10-02T12:00:00.000Z",
    },
    verifiedFacts: [
      {
        id: "fact-1",
        jobId: "g3-job",
        factKey: "mandatory_license",
        evidence: {
          kind: "mandatory_license",
          sourceType: "url",
          sourceUrl: "https://example.com/posting",
          note: "Verified licence requirement",
          verifiedBy: "user",
        },
        createdAt: "2026-10-02T12:00:00.000Z",
        updatedAt: "2026-10-02T12:00:00.000Z",
      },
    ],
  });
});

it("shows LMIA as historical-only and keeps G2 hard facts distinct", async () => {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ImmigrationProfilePanel jobId="g3-job" />
    </QueryClientProvider>,
  );

  expect(
    await screen.findByText(
      /Historical LMIA is an employer-history signal only/i,
    ),
  ).toBeInTheDocument();
  expect(screen.getByText(/Matched rows:/)).toHaveTextContent("3");
  expect(screen.getByText(/Streams:/)).toHaveTextContent(
    "Global Talent Stream, High-wage",
  );
  expect(
    screen.getByText(/Verified hard requirements \(G2\):/),
  ).toHaveTextContent("mandatory_license");
});
