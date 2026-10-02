import type { StageEvidence } from "@shared/types";

export function EvidenceSummary({
  evidence,
}: {
  evidence?: StageEvidence | null;
}) {
  if (!evidence) return null;
  return (
    <div className="my-2 break-words rounded border p-2 text-xs">
      <strong>Verified evidence: {evidence.kind.replaceAll("_", " ")}</strong>
      <div>
        Source: {evidence.sourceType.replaceAll("_", " ")}
        {evidence.sourceId ? ` · ${evidence.sourceId}` : ""}
      </div>
      {evidence.sourceUrl && <div>{evidence.sourceUrl}</div>}
      {evidence.note && <div>{evidence.note}</div>}
      <div>Verified by: {evidence.verifiedBy}</div>
    </div>
  );
}
