import * as api from "@client/api";
import type {
  ImmigrationEmployerSupportStatus,
  JobImmigrationProfile,
} from "@shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const supportOptions: ImmigrationEmployerSupportStatus[] = [
  "unknown",
  "possible",
  "confirmed",
  "not_available",
];

function nullableNumber(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ImmigrationProfilePanel({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["job-immigration-profile", jobId];
  const context = useQuery({
    queryKey,
    queryFn: () => api.getJobImmigrationContext(jobId),
  });
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [verified, setVerified] = useState(false);
  const save = useMutation({
    mutationFn: (form: HTMLFormElement) => {
      const data = new FormData(form);
      const profile = context.data?.profile;
      const evidence = [...(profile?.evidence ?? [])];
      if (evidenceNote.trim() && verified) {
        evidence.push({
          sourceType: evidenceUrl.trim() ? "url" : "manual_verified",
          sourceUrl: evidenceUrl.trim() || undefined,
          note: evidenceNote.trim(),
          verifiedBy: "user",
        });
      }
      const travel = String(data.get("usTravelRequired") ?? "");
      return api.saveJobImmigrationProfile(jobId, {
        nocCode: String(data.get("nocCode") ?? "").trim() || null,
        employerSupportStatus: String(
          data.get("employerSupportStatus") ?? "unknown",
        ) as ImmigrationEmployerSupportStatus,
        workPermitRequirement:
          String(data.get("workPermitRequirement") ?? "").trim() || null,
        usTravelRequired: travel === "" ? null : travel === "true",
        wageHourlyCad: nullableNumber(data.get("wageHourlyCad")),
        wageAnnualCad: nullableNumber(data.get("wageAnnualCad")),
        immigrationNotes:
          String(data.get("immigrationNotes") ?? "").trim() || null,
        evidence,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      setEvidenceNote("");
      setEvidenceUrl("");
      setVerified(false);
    },
  });
  const refreshLmia = useMutation({
    mutationFn: () => api.refreshJobLmiaHistory(jobId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  if (context.isLoading) {
    return (
      <section className="my-4 rounded border p-3">
        Loading Canada / immigration...
      </section>
    );
  }

  const profile: JobImmigrationProfile | null = context.data?.profile ?? null;
  const error = context.error || save.error || refreshLmia.error;
  const factKeys =
    context.data?.verifiedFacts.map((fact) => fact.factKey) ?? [];

  return (
    <section className="my-4 space-y-3 rounded border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Canada / Immigration</h3>
          <p className="text-sm text-muted-foreground">
            Historical LMIA is an employer-history signal only. It is not
            evidence of current sponsorship or a current job-specific LMIA.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={refreshLmia.isPending}
          onClick={() => refreshLmia.mutate()}
        >
          {refreshLmia.isPending ? "Checking..." : "Refresh LMIA history"}
        </Button>
      </div>

      <div className="rounded bg-muted/40 p-2 text-sm">
        <div>
          LMIA signal:{" "}
          <strong>{profile?.lmiaHistoricalSignal ?? "unknown"}</strong>
        </div>
        <div>
          Latest matched quarter: {profile?.lmiaLatestQuarter ?? "unknown"}
        </div>
        <div>Matched rows: {profile?.lmiaMatchedRows ?? 0}</div>
        <div>Streams: {profile?.lmiaStreams.join(", ") || "none"}</div>
        {profile?.lmiaSourceDate && (
          <div>Provider refreshed: {profile.lmiaSourceDate}</div>
        )}
      </div>

      <div className="text-sm">
        Verified hard requirements (G2):{" "}
        {factKeys.length ? factKeys.join(", ") : "none"}
      </div>
      <form
        key={profile?.updatedAt ?? "new"}
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (evidenceNote.trim() && !verified) return;
          save.mutate(event.currentTarget);
        }}
      >
        <label>
          NOC
          <input
            name="nocCode"
            className="block w-full rounded border bg-background p-2"
            defaultValue={profile?.nocCode ?? ""}
            placeholder="72422"
          />
        </label>
        <label>
          Employer support
          <select
            name="employerSupportStatus"
            className="block w-full rounded border bg-background p-2"
            defaultValue={profile?.employerSupportStatus ?? "unknown"}
          >
            {supportOptions.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="md:col-span-2">
          Work-permit requirement / employer wording
          <textarea
            name="workPermitRequirement"
            className="block w-full rounded border bg-background p-2"
            defaultValue={profile?.workPermitRequirement ?? ""}
          />
        </label>
        <label>
          US travel required
          <select
            name="usTravelRequired"
            className="block w-full rounded border bg-background p-2"
            defaultValue={
              profile?.usTravelRequired === null ||
              profile?.usTravelRequired === undefined
                ? ""
                : String(profile.usTravelRequired)
            }
          >
            <option value="">Unknown</option>
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </label>
        <label>
          Hourly wage CAD
          <input
            name="wageHourlyCad"
            type="number"
            min="0"
            step="0.01"
            className="block w-full rounded border bg-background p-2"
            defaultValue={profile?.wageHourlyCad ?? ""}
          />
        </label>
        <label>
          Annual wage CAD
          <input
            name="wageAnnualCad"
            type="number"
            min="0"
            step="1"
            className="block w-full rounded border bg-background p-2"
            defaultValue={profile?.wageAnnualCad ?? ""}
          />
        </label>
        <label className="md:col-span-2">
          Immigration notes
          <textarea
            name="immigrationNotes"
            className="block w-full rounded border bg-background p-2"
            defaultValue={profile?.immigrationNotes ?? ""}
          />
        </label>
        <div className="md:col-span-2 rounded border border-dashed p-2">
          <p className="mb-2 text-sm font-medium">
            Add supporting evidence (optional)
          </p>
          <input
            type="url"
            className="mb-2 block w-full rounded border bg-background p-2"
            value={evidenceUrl}
            onChange={(event) => setEvidenceUrl(event.target.value)}
            placeholder="Source URL"
          />
          <textarea
            className="block w-full rounded border bg-background p-2"
            value={evidenceNote}
            onChange={(event) => setEvidenceNote(event.target.value)}
            placeholder="What did you personally verify?"
          />
          <label className="mt-2 block text-sm">
            <input
              type="checkbox"
              checked={verified}
              onChange={(event) => setVerified(event.target.checked)}
            />{" "}
            I personally checked this source; this is not an AI inference.
          </label>
          {profile?.evidence.map((item) => (
            <p
              key={`${item.sourceType}:${item.sourceId ?? item.sourceUrl ?? item.note}`}
              className="mt-1 text-xs text-muted-foreground"
            >
              Evidence: {item.note}
              {item.sourceUrl ? ` - ${item.sourceUrl}` : ""}
            </p>
          ))}
        </div>
        {error && (
          <p role="alert" className="md:col-span-2">
            {error.message}
          </p>
        )}
        {evidenceNote.trim() && !verified && (
          <p role="alert" className="md:col-span-2 text-sm">
            Confirm that you personally checked the evidence before saving it.
          </p>
        )}
        <div className="md:col-span-2">
          <Button
            type="submit"
            disabled={
              save.isPending || Boolean(evidenceNote.trim() && !verified)
            }
          >
            {save.isPending ? "Saving..." : "Save immigration profile"}
          </Button>
        </div>
      </form>
    </section>
  );
}
