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
  it("offers older ready vacancies when there are no matches this week", async () => {
    vi.mocked(api.getJobs).mockImplementation(
      async (input) =>
        ({
          jobs: input?.statuses?.includes("ready")
            ? [{
                id: "historical",
                title: "Previously ready position",
                discoveredAt: new Date(Date.now() - 9 * 86400000).toISOString(),
              }]
            : [],
        }) as unknown as Awaited<ReturnType<typeof api.getJobs>>,
    );
    renderWithQueryClient(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<CandidateHomePage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("No new matches in this period")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "All ready" }).at(-1)!);
    expect(await screen.findByText("Previously ready position")).toBeInTheDocument();
  });

  it("filters matches correctly across 24 hours, 3 days and 7 days", async () => {
    const now = Date.now();
    const match = (id: string, ageHours: number) => ({
      id,
      title: id,
      discoveredAt: new Date(now - ageHours * 3600000).toISOString(),
    });
    vi.mocked(api.getJobs).mockImplementation(
      async (input) =>
        ({
          jobs: input?.statuses?.includes("ready")
            ? [
                match("Today match", 12),
                match("Two-day match", 48),
                match("Six-day match", 144),
                match("Expired match", 192),
                { id: "Undated match", title: "Undated match", discoveredAt: "invalid-date" },
                match("Future match", -24),
              ]
            : [],
        }) as unknown as Awaited<ReturnType<typeof api.getJobs>>,
    );
    renderWithQueryClient(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<CandidateHomePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Today match")).toBeInTheDocument();
    expect(screen.getByText("Two-day match")).toBeInTheDocument();
    expect(screen.getByText("Six-day match")).toBeInTheDocument();
    expect(screen.queryByText("Expired match")).not.toBeInTheDocument();
    expect(screen.queryByText("Undated match")).not.toBeInTheDocument();
    expect(screen.queryByText("Future match")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "3 days" }));
    expect(screen.getByText("Today match")).toBeInTheDocument();
    expect(screen.getByText("Two-day match")).toBeInTheDocument();
    expect(screen.queryByText("Six-day match")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "24 hours" }));
    expect(screen.getByText("Today match")).toBeInTheDocument();
    expect(screen.queryByText("Two-day match")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    expect(screen.getByText("Six-day match")).toBeInTheDocument();
    expect(screen.queryByText("Expired match")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "All ready" }));
    expect(screen.getByText("Expired match")).toBeInTheDocument();
    expect(screen.queryByText("Future match")).not.toBeInTheDocument();
  });
});
