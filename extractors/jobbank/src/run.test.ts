import { describe, expect, it } from "vitest";
import { parseJobBankFeed } from "./run";

describe("parseJobBankFeed", () => {
  it("marks Job Bank locations as Canadian so location filtering does not drop valid provincial locations", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <feed>
        <entry>
          <title>industrial electrician</title>
          <link rel="alternate" href="https://www.jobbank.gc.ca/jobsearch/jobposting/12345678" />
          <updated>2026-10-07T01:00:00Z</updated>
          <summary><![CDATA[
            <strong>Employer:</strong> Example Manufacturing<br/>
            <strong>Location:</strong> Toronto, ON<br/>
            <strong>Salary:</strong> $40.00 hourly<br/>
            <strong>Job number:</strong> 12345678<br/>
          ]]></summary>
        </entry>
      </feed>`;

    const [job] = parseJobBankFeed(xml);

    expect(job).toBeDefined();
    expect(job?.locationEvidence).toMatchObject({
      location: "Toronto, ON",
      country: "canada",
      countryKey: "canada",
      source: "jobbank",
    });
  });
});
