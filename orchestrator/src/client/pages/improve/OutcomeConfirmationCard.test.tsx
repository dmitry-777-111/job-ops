import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OutcomeConfirmationCard } from "./OutcomeConfirmationCard";

const mocks = vi.hoisted(() => ({
  transitionJobStage: vi.fn(),
}));

vi.mock("@client/api", () => ({
  transitionJobStage: mocks.transitionJobStage,
}));

const job = {
  id: "job-1",
  source: "test",
  sourceJobId: null,
  title: "Role",
  employer: "Employer",
  jobUrl: "https://example.com/job",
  applicationLink: null,
  datePosted: null,
  deadline: null,
  salary: null,
  location: null,
  status: "in_progress" as const,
  outcome: null,
  closedAt: null,
  suitabilityScore: 85,
  sponsorMatchScore: null,
  appliedDuplicateMatch: null,
  jobType: null,
  jobFunction: null,
  pdfRegenerating: false,
  pdfFreshness: "missing" as const,
  salaryMinAmount: null,
  salaryMaxAmount: null,
  salaryCurrency: null,
  discoveredAt: "2026-10-01T00:00:00.000Z",
  readyAt: null,
  appliedAt: "2026-10-02T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
};

const interviewEvent = {
  id: "evt-1",
  applicationId: "job-1",
  title: "Technical Interview",
  groupId: null,
  fromStage: "hiring_manager_screen" as const,
  toStage: "technical_interview" as const,
  occurredAt: 1_700_000_000,
  metadata: { interviewDebrief: "Interview completed." },
  outcome: null,
};

function renderCard() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const onResolved = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <OutcomeConfirmationCard
        pending={{
          job,
          interviewEvent,
          nextStage: "onsite",
          dueAt: 1_700_432_000,
          lastCheckedAt: null,
        }}
        onResolved={onResolved}
      />
    </QueryClientProvider>,
  );
  return { onResolved };
}

describe("OutcomeConfirmationCard", () => {
  it("records a confirmed next stage with user-verified evidence", async () => {
    mocks.transitionJobStage.mockResolvedValue({});
    const { onResolved } = renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Next stage" }));

    await waitFor(() =>
      expect(mocks.transitionJobStage).toHaveBeenCalledWith(
        "job-1",
        expect.objectContaining({
          toStage: "onsite",
          metadata: expect.objectContaining({
            evidence: expect.objectContaining({
              kind: "interview",
              sourceType: "manual_verified",
              verifiedBy: "user",
            }),
          }),
        }),
      ),
    );
    expect(onResolved).toHaveBeenCalled();
  });

  it("records rejection as an explicit outcome and still-waiting as a note", async () => {
    mocks.transitionJobStage.mockResolvedValue({});
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Rejected" }));
    await waitFor(() =>
      expect(mocks.transitionJobStage).toHaveBeenCalledWith(
        "job-1",
        expect.objectContaining({ toStage: "closed", outcome: "rejected" }),
      ),
    );

    mocks.transitionJobStage.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Still waiting" }));
    await waitFor(() =>
      expect(mocks.transitionJobStage).toHaveBeenCalledWith(
        "job-1",
        expect.objectContaining({
          toStage: "no_change",
          metadata: expect.objectContaining({ outcomeCheck: "waiting" }),
        }),
      ),
    );
  });
});
