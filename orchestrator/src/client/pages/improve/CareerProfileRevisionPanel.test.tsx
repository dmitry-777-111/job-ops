import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CareerProfileRevisionPanel } from "./CareerProfileRevisionPanel";

const mocks = vi.hoisted(() => ({
  getActiveMasterCareerProfile: vi.fn(),
  createMasterCareerProfileDraft: vi.fn(),
  activateMasterCareerProfileVersion: vi.fn(),
}));

vi.mock("@client/api", () => ({
  getActiveMasterCareerProfile: mocks.getActiveMasterCareerProfile,
  createMasterCareerProfileDraft: mocks.createMasterCareerProfileDraft,
  activateMasterCareerProfileVersion: mocks.activateMasterCareerProfileVersion,
}));

const active = {
  id: "profile-v1",
  version: 1,
  status: "active" as const,
  profile: {
    basics: {
      name: "Candidate",
      label: "Teacher",
      headline: "Educator",
      summary: "Teaching background.",
    },
    sections: {
      experience: {
        items: [
          {
            id: "exp-1",
            company: "School",
            position: "Teacher",
            location: "Moscow",
            date: "2020-2025",
            summary: "Worked with students.",
            visible: true,
          },
        ],
      },
    },
  },
  source: "manual" as const,
  sourceRef: null,
  provenance: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  activatedAt: "2026-10-01T00:00:00.000Z",
  supersededAt: null,
};

const draft = {
  ...active,
  id: "profile-v2",
  version: 2,
  status: "draft" as const,
  activatedAt: null,
  profile: {
    ...active.profile,
    basics: {
      ...active.profile.basics,
      label: "Retail Associate",
      headline: "Customer-focused retail candidate",
    },
  },
};

const snapshot = {
  stage: "market_entry" as const,
  confidence: "moderate" as const,
  target: "profile" as const,
  title: "Positioning needs review",
  evidence: "Response rate is low across qualified applications.",
  recommendation: "Test clearer customer-facing positioning.",
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
      <CareerProfileRevisionPanel
        recommendationKey="market-entry-low-response"
        snapshot={snapshot}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("CareerProfileRevisionPanel", () => {
  it("creates a profile draft without activating it, then activates only on a separate click", async () => {
    mocks.getActiveMasterCareerProfile.mockResolvedValue(active);
    mocks.createMasterCareerProfileDraft.mockResolvedValue(draft);
    mocks.activateMasterCareerProfileVersion.mockResolvedValue({
      ...draft,
      status: "active",
      activatedAt: "2026-10-06T23:30:00.000Z",
    });

    renderPanel();

    const label = await screen.findByLabelText("Professional label");
    expect(label).toHaveValue("Teacher");
    fireEvent.change(label, { target: { value: "Retail Associate" } });
    fireEvent.change(screen.getByLabelText("Headline"), {
      target: { value: "Customer-focused retail candidate" },
    });

    expect(
      screen.getByText(/New draft will change: Professional label, Headline/),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Create profile draft" }),
    );

    await screen.findByText("Draft v2");
    expect(mocks.createMasterCareerProfileDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceRef: "career-recommendation:market-entry-low-response",
        profile: expect.objectContaining({
          basics: expect.objectContaining({
            label: "Retail Associate",
            headline: "Customer-focused retail candidate",
          }),
          sections: active.profile.sections,
        }),
        provenance: expect.objectContaining({
          userApprovedRecommendation: true,
          recommendationKey: "market-entry-low-response",
        }),
      }),
    );
    expect(mocks.activateMasterCareerProfileVersion).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Activate this profile version" }),
    );

    await waitFor(() =>
      expect(mocks.activateMasterCareerProfileVersion).toHaveBeenCalledWith(
        "profile-v2",
      ),
    );
    expect(
      await screen.findByText("Career profile v2 is now active."),
    ).toBeInTheDocument();
  });
});
