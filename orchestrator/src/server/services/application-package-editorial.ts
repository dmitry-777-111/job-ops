// Deliberately deterministic: formatting is not permission to paraphrase facts.
// Only inert presentation tags are ignored. Unknown markup stays significant.
export function retargetExplicitSummary(text: string, target: string): string {
  return text.replace(
    /(<p[^>]*>\s*(?:<strong>)?Target position(?:<\/strong>)?\s*<\/p>\s*<p[^>]*>)[\s\S]*?(<\/p>)/gi,
    (_match, prefix: string, suffix: string) => `${prefix}${target}${suffix}`,
  );
}

export function normalizeEditorialText(text: string): string {
  return text
    .replace(/<\/?(?:p|div|ul|ol|li|br)\s*\/?\s*>/gi, " ")
    .replace(/<\/?(?:strong|b|em|i|span)\s*>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function editorialCoverMatches(
  actual: string,
  expected: string,
): boolean {
  // Keep complete lines/claims intact: sorting words or splitting clauses could
  // drop a negation or attach a qualification to a different employer.
  const lines = (text: string) =>
    text
      .split(/\r?\n/)
      .map((line) => normalizeEditorialText(line).replace(/^[-•]\s+/, ""))
      .filter(Boolean);
  const candidate = lines(actual);
  const source = lines(expected);
  const greeting = new Set(["Dear Hiring Team,", "Dear Hiring Manager,"]);
  const closing = new Set(["Sincerely,", "Kind regards,"]);
  const canonical = (line: string) =>
    greeting.has(line)
      ? "__greeting__"
      : closing.has(line)
        ? "__closing__"
        : line;
  // Intro, conclusion, sign-off and name retain their positions; only complete
  // evidence bullets may be reordered, with multiplicity preserved.
  const compare = (values: string[]) => {
    const start = values.indexOf(
      "Verified experience and skills relevant to the posted requirements:",
    );
    const end = values.indexOf(
      "I would welcome the opportunity to discuss how this verified background relates to the role.",
    );
    if (start >= 0 && end > start)
      values.splice(
        start + 1,
        end - start - 1,
        ...values.slice(start + 1, end).sort(),
      );
    return values.map(canonical);
  };
  return JSON.stringify(compare(candidate)) === JSON.stringify(compare(source));
}
