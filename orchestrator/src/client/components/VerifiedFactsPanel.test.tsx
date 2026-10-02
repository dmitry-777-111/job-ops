import * as api from "@client/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { VerifiedFactsPanel } from "./VerifiedFactsPanel";

vi.mock("@client/api", () => ({
  getJobVerifiedFacts: vi.fn(),
  saveJobVerifiedFact: vi.fn(),
  removeJobVerifiedFact: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getJobVerifiedFacts).mockResolvedValue([]);
});
it("requires personal verification and submits the original source", async () => {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <VerifiedFactsPanel jobId="g2-job" />
    </QueryClientProvider>,
  );
  const button = screen.getByRole("button", {
    name: "Save verified requirement",
  });
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Source and supporting statement"), {
    target: { value: "Posting explicitly states no sponsorship" },
  });
  fireEvent.change(screen.getByLabelText("Source URL (if available)"), {
    target: { value: "https://example.com/original" },
  });
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(button);
  await waitFor(() =>
    expect(api.saveJobVerifiedFact).toHaveBeenCalledWith(
      "g2-job",
      "no_sponsorship",
      expect.objectContaining({
        verifiedBy: "user",
        sourceType: "url",
        sourceUrl: "https://example.com/original",
        note: "Posting explicitly states no sponsorship",
      }),
    ),
  );
});
