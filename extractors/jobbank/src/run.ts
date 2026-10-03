import type { ExtractorProgressEvent } from "@shared/types/extractors";
import type { CreateJobInput } from "@shared/types/jobs";

const FEED_URL = "https://www.jobbank.gc.ca/jobsearch/feed/jobSearchRSSfeed";
const PAGE_SIZE = 100;
const MAX_PAGES_PER_TERM = 5;
const REQUEST_DELAY_MS = 5_000;

export interface RunJobBankOptions {
  searchTerms: string[];
  shouldCancel?: () => boolean;
  onProgress?: (event: ExtractorProgressEvent) => void;
  fetchImpl?: typeof fetch;
  delayMs?: number;
  maxPagesPerTerm?: number;
}

export interface JobBankResult {
  success: boolean;
  jobs: CreateJobInput[];
  sourceErrors?: string[];
  error?: string;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function innerText(block: string, tag: string): string {
  const match = block.match(
    new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"),
  );
  if (!match) return "";
  const raw = match[1].trim();
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return decodeEntities((cdata?.[1] ?? raw).trim());
}

function stripTags(value: string): string {
  let current = value;
  let previous = "";
  while (current !== previous) {
    previous = current;
    current = current.replace(/<[^>]+>/g, "");
  }
  return decodeEntities(current.replace(/[<>]/g, "")).trim();
}

function summaryField(summary: string, label: string): string {
  const match = summary.match(
    new RegExp(
      `<strong>${label}:</strong>\\s*([\\s\\S]*?)\\s*(?:<br\\s*/?>|$)`,
      "i",
    ),
  );
  return match ? stripTags(match[1]) : "";
}

function linkHref(entry: string): string {
  const tags = entry.match(/<link(?=[\s/>])[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1];
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href && rel?.toLowerCase() === "alternate") return decodeEntities(href);
  }
  const href = tags[0]?.match(/\bhref=["']([^"']+)["']/i)?.[1];
  return href ? decodeEntities(href) : "";
}

function trustedJobUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "www.jobbank.gc.ca"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function buildJobBankFeedUrl(searchTerm: string, page: number): string {
  const url = new URL(FEED_URL);
  url.searchParams.set("searchstring", searchTerm);
  url.searchParams.set("locationstring", "");
  url.searchParams.set("page", String(page));
  url.searchParams.set("rows", String(PAGE_SIZE));
  url.searchParams.set("sort", "D");
  return url.href;
}

export function parseJobBankFeed(xml: string): CreateJobInput[] {
  const entries = xml.match(/<entry\b[^>]*>[\s\S]*?<\/entry>/gi) ?? [];
  const jobs: CreateJobInput[] = [];
  for (const entry of entries) {
    const title = stripTags(innerText(entry, "title"));
    const jobUrl = trustedJobUrl(linkHref(entry));
    if (!title || !jobUrl) continue;
    const summary = innerText(entry, "summary");
    const employer = summaryField(summary, "Employer");
    const location = summaryField(summary, "Location");
    const salary = summaryField(summary, "Salary");
    const sourceJobId = summaryField(summary, "Job number");
    const updated = innerText(entry, "updated");
    jobs.push({
      source: "jobbank",
      sourceJobId: sourceJobId || undefined,
      title,
      employer: employer || "Unknown employer",
      jobUrl,
      jobUrlDirect: jobUrl,
      applicationLink: jobUrl,
      location: location || undefined,
      locationEvidence: location ? { location, source: "jobbank" } : undefined,
      salary: salary || undefined,
      datePosted: updated || undefined,
      jobDescription: stripTags(summary) || undefined,
    });
  }
  return jobs;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runJobBank(
  options: RunJobBankOptions,
): Promise<JobBankResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const terms = options.searchTerms.map((term) => term.trim()).filter(Boolean);
  const byUrl = new Map<string, CreateJobInput>();
  const sourceErrors: string[] = [];
  let successfulTerms = 0;

  for (const [termOffset, searchTerm] of terms.entries()) {
    if (options.shouldCancel?.()) break;
    const termIndex = termOffset + 1;
    options.onProgress?.({
      phase: "list",
      termsProcessed: termOffset,
      termsTotal: terms.length,
      currentUrl: searchTerm,
      detail: `Job Bank: term ${termIndex}/${terms.length} (${searchTerm})`,
    });
    let termFailed = false;
    for (
      let page = 1;
      page <= (options.maxPagesPerTerm ?? MAX_PAGES_PER_TERM);
      page += 1
    ) {
      if (options.shouldCancel?.()) break;
      await wait(options.delayMs ?? REQUEST_DELAY_MS);
      try {
        const response = await fetchImpl(
          buildJobBankFeedUrl(searchTerm, page),
          {
            headers: { "user-agent": "CAREER-OS/1.0 (+Job Bank public feed)" },
            redirect: "error",
          },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const xml = await response.text();
        const rawCount = (xml.match(/<entry\b[^>]*>[\s\S]*?<\/entry>/gi) ?? [])
          .length;
        for (const job of parseJobBankFeed(xml)) byUrl.set(job.jobUrl, job);
        if (rawCount < PAGE_SIZE) break;
      } catch (error) {
        if (page === 1) termFailed = true;
        sourceErrors.push(
          `jobbank:${searchTerm}: ${error instanceof Error ? error.message : String(error)}`,
        );
        break;
      }
    }
    if (!termFailed) successfulTerms += 1;
    options.onProgress?.({
      phase: "list",
      termsProcessed: termIndex,
      termsTotal: terms.length,
      currentUrl: searchTerm,
      jobCardsFound: byUrl.size,
      detail: `Job Bank: completed ${termIndex}/${terms.length}`,
    });
  }

  if (terms.length > 0 && successfulTerms === 0 && sourceErrors.length > 0) {
    return {
      success: false,
      jobs: [],
      error: `Job Bank: all keyword requests failed: ${sourceErrors[0]}`,
    };
  }
  return { success: true, jobs: [...byUrl.values()], sourceErrors };
}
