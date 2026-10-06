import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CareerStrategyRevisionPanel } from "./CareerStrategyRevisionPanel";

const mocks = vi.hoisted(() => ({
  getActiveCandidateStrategy: vi.fn(),
  createCandidateStrategyDraft: vi.fn(),
  getCandidateStrategyDelta: vi.fn(),
  activateCandidateStrategyVersion: vi.fn(),
}));

vi.mock("@client/api", () => ({
  getActiveCandidateStrategy: mocks.getActiveCandidateStrategy,
  createCandidateStrategyDraft: mocks.createCandidateStrategyDraft,
  getCandidateStrategyDelta: mocks.getCandidateStrategyDelta,
  activateCandidateStrategyVersion: mocks.activateCandidateStrategyVersion,
}));

const active = {
  id: "strategy-v1",
  version: 1,
  status: "active" as const,
  targetMarkets: ["canada"],
  targetRoleFamilies: ["retail"],
  excludedRoleFamilies: ["sales"],
  constraints: [
    {
      id: "work-auth",
      key: "work_authorization",
      kind: "hard" as const,
      value: "permit",
      source: "candidate" as const,
      confidence: 1,
      effectiveAt: "2026-10-01T00:00:00.000Z",
    },
  ],
  freeformNotes: "Current strategy",
  createdAt: "2026-10-01T00:00:00.000Z",
  activatedAt: "2026-10-01T00:00:00.000Z",
};

const draft = {
  ...active,
  id: "strategy-v2",
  version: 2,
  status: "draft" as const,
  targetRoleFamilies: ["retail", "factory"],
  activatedAt: null,
};

const snapshot = {
  stage: "market_entry" as const,
  confidence: "moderate" as const,
  target: "mixed" as const,
  title: "Too few relevant applications are turning into conversations",
  evidence: "1 of 10 qualified applications reached a response stage.",
  recommendation: "Review targeting and positioning.",
};

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <CareerStrategyRevisionPanel
        recommendationKey="market-entry-low-response"
        snapshot={snapshot}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("CareerStrategyRevisionPanel", () => {
  it("creates a draft first and activates only after a separate user action", async () => {
    mocks.getActiveCandidateStrategy.mockResolvedValue(active);
    mocks.createCandidateStrategyDraft.mockResolvedValue(draft);
    mocks.getCandidateStrategyDelta.mockResolvedValue({
      previousVersion: 1,
      nextVersion: 2,
      added: [],
      removedConstraintIds: [],
      changed: [],
      likelySearchImpact: ["Role-family coverage changed."],
    });
    mocks.activateCandidateStrategyVersion.mockResolvedValue({
      ...draft,
      status: "active",
      activatedAt: "2026-10-06T23:30:00.000Z",
    });

    renderPanel();

    const roles = await screen.findByLabelText("Target role families");
    expect(roles).toHaveValue("retail");
    fireEvent.change(roles, { target: { value: "retail, factory" } });

    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));

    await screen.findByText("Draft v2");
    expect(mocks.createCandidateStrategyDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRoleFamilies: ["retail", "factory"],
        constraints: active.constraints,
        freeformNotes: expect.stringContaining(
          "TJAgent recommendation accepted for review: market-entry-low-response",
        ),
      }),
    );
    expect(mocks.activateCandidateStrategyVersion).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Activate this version" }),
    );

    await waitFor(() =>
      expect(mocks.activateCandidateStrategyVersion).toHaveBeenCalledWith(
        "strategy-v2",
      ),
    );
    expect(
      await screen.findByText("Strategy v2 is now active."),
    ).toBeInTheDocument();
  });
});
