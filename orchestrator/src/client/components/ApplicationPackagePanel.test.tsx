import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQueryClient } from "@/client/test/renderWithQueryClient";
import { ApplicationPackagePanel } from "./ApplicationPackagePanel";

const mocks = vi.hoisted(() => ({
  getApplicationPackageJobFlow: vi.fn(),
  prepareApplicationPackageForJob: vi.fn(),
}));

vi.mock("@/client/api", () => ({
  getApplicationPackageJobFlow: mocks.getApplicationPackageJobFlow,
  prepareApplicationPackageForJob: mocks.prepareApplicationPackageForJob,
}));

function renderPanel() {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={["/job/job-1"]}>
      <Routes>
        <Route
          path="/job/:id"
          element={<ApplicationPackagePanel jobId="job-1" />}
        />
        <Route
          path="/applications/package/:id"
          element={<div>Package review destination</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ApplicationPackagePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApplicationPackageJobFlow.mockResolvedValue({
      legacyJobId: "job-1",
      marketPostingId: "posting-1",
      liveGate: {
        state: "live",
        blocksGeneration: false,
        requiresReview: false,
        reason: "authoritative_live_evidence",
        evidence: null,
        canonicalStatus: "live",
        evaluatedAt: "2026-10-04T12:00:00.000Z",
      },
      applicationPackages: [],
    });
    mocks.prepareApplicationPackageForJob.mockResolvedValue({
      applicationPackage: {
        id: "package-1",
        version: 1,
        status: "draft",
      },
      preparation: {},
    });
  });

  it("offers one Prepare application action and navigates to review after creation", async () => {
    renderPanel();

    const button = await screen.findByRole("button", {
      name: "Prepare application",
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mocks.prepareApplicationPackageForJob).toHaveBeenCalledWith(
        "job-1",
        { acknowledgeUnknownLiveState: false },
      );
    });
    expect(
      await screen.findByText("Package review destination"),
    ).toBeInTheDocument();
  });

  it("blocks preparation for a closed vacancy", async () => {
    mocks.getApplicationPackageJobFlow.mockResolvedValue({
      legacyJobId: "job-1",
      marketPostingId: "posting-1",
      liveGate: {
        state: "closed",
        blocksGeneration: true,
        requiresReview: false,
        reason: "authoritative_closed_evidence",
        evidence: null,
        canonicalStatus: "closed",
        evaluatedAt: "2026-10-04T12:00:00.000Z",
      },
      applicationPackages: [],
    });

    renderPanel();

    const button = await screen.findByRole("button", {
      name: "Prepare application",
    });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(/authoritative evidence marks this vacancy as closed/i),
    ).toBeInTheDocument();
  });

  it("requires explicit acknowledgement for an unknown live state", async () => {
    mocks.getApplicationPackageJobFlow.mockResolvedValue({
      legacyJobId: "job-1",
      marketPostingId: "posting-1",
      liveGate: {
        state: "unknown",
        blocksGeneration: false,
        requiresReview: true,
        reason: "no_authoritative_live_evidence",
        evidence: null,
        canonicalStatus: "live",
        evaluatedAt: "2026-10-04T12:00:00.000Z",
      },
      applicationPackages: [],
    });

    renderPanel();

    const button = await screen.findByRole("button", {
      name: "Prepare application",
    });
    expect(button).toBeDisabled();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /current vacancy status cannot be verified/i,
      }),
    );
    expect(button).toBeEnabled();

    fireEvent.click(button);
    await waitFor(() => {
      expect(mocks.prepareApplicationPackageForJob).toHaveBeenCalledWith(
        "job-1",
        { acknowledgeUnknownLiveState: true },
      );
    });
  });
});
