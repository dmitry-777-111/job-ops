import { describe, expect, it, vi } from "vitest";
import { buildJobBankFeedUrl, parseJobBankFeed, runJobBank } from "../src/run";

const SAMPLE = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>electromechanical technician</title><link rel="alternate" type="text/html" href="https://www.jobbank.gc.ca/jobsearch/jobposting/123456"/><updated>2026-10-03T10:00:00Z</updated><summary><![CDATA[<strong>Job number:</strong> 123456<br /><strong>Location:</strong> Toronto (ON)<br /><strong>Employer:</strong> Example Automation Inc.<br /><strong>Salary:</strong> $40.00 hourly]]></summary></entry></feed>`;

describe("Job Bank public feed", () => {
  it("builds a bounded public feed URL", () => {
    const url = new URL(buildJobBankFeedUrl("field service technician", 2));
    expect(url.hostname).toBe("www.jobbank.gc.ca");
    expect(url.pathname).toBe("/jobsearch/feed/jobSearchRSSfeed");
    expect(url.searchParams.get("searchstring")).toBe(
      "field service technician",
    );
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("rows")).toBe("100");
  });

  it("parses Job Bank Atom evidence into a normalized job", () => {
    expect(parseJobBankFeed(SAMPLE)).toEqual([
      expect.objectContaining({
        source: "jobbank",
        sourceJobId: "123456",
        title: "electromechanical technician",
        employer: "Example Automation Inc.",
        location: "Toronto (ON)",
        salary: "$40.00 hourly",
        datePosted: "2026-10-03T10:00:00Z",
      }),
    ]);
  });

  it("keeps successful terms when another term fails", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(SAMPLE, { status: 200 }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    const result = await runJobBank({
      searchTerms: ["electromechanical", "commissioning"],
      fetchImpl,
      delayMs: 0,
      maxPagesPerTerm: 1,
    });
    expect(result.success).toBe(true);
    expect(result.jobs).toHaveLength(1);
    expect(result.sourceErrors).toHaveLength(1);
  });

  it("fails only when every term fails", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("unavailable", { status: 503 }));
    const result = await runJobBank({
      searchTerms: ["electromechanical", "commissioning"],
      fetchImpl,
      delayMs: 0,
      maxPagesPerTerm: 1,
    });
    expect(result.success).toBe(false);
    expect(result.jobs).toEqual([]);
  });
});
