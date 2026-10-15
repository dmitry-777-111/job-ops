import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import * as api from "@/client/api";
import { renderWithQueryClient } from "../test/renderWithQueryClient";
import { CandidateHomePage } from "./CandidateHomePage";

vi.mock("@/client/api", () => ({
  getJobs: vi.fn(),
  prepareApplicationPackageForJob: vi.fn(),
}));
function Destination() {
  const location = useLocation();
  return <div>{location.pathname + location.search}</div>;
}
describe("CandidateHomePage", () => {
  it.each([
    ["Resume and profiles", "/onboarding?review=resume"],
    ["Review setup", "/onboarding?review=profile"],
    ["Resume Studio", "/design-resume"],
  ])("shows a three-day-old match by default and opens %s", async (label, target) => {
    vi.mocked(api.getJobs).mockImplementation(
      async (input) =>
        ({
          jobs: input?.statuses?.includes("ready")
            ? [
                {
                  id: "recent",
                  title: "Recent match",
                  discoveredAt: new Date(
                    Date.now() - 3 * 86400000,
                  ).toISOString(),
                },
                {
                  id: "old",
                  title: "Old match",
                  discoveredAt: new Date(
                    Date.now() - 8 * 86400000,
                  ).toISOString(),
                },
              ]
            : [],
        }) as unknown as Awaited<ReturnType<typeof api.getJobs>>,
    );
    renderWithQueryClient(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<CandidateHomePage />} />
          <Route path="*" element={<Destination />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Recent match")).toBeInTheDocument();
    expect(screen.queryByText("Old match")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "24 hours" }));
    expect(screen.queryByText("Recent match")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(await screen.findByText(target)).toBeInTheDocument();
  });
});
