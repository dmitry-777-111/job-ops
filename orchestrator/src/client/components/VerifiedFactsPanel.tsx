import * as api from "@client/api";
import { VERIFIED_JOB_FACT_KEYS, type VerifiedJobFactKey } from "@shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EvidenceSummary } from "./EvidenceSummary";

export function VerifiedFactsPanel({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["job-verified-facts", jobId];
  const facts = useQuery({
    queryKey,
    queryFn: () => api.getJobVerifiedFacts(jobId),
  });
  const [factKey, setFactKey] = useState<VerifiedJobFactKey>("no_sponsorship");
  const [note, setNote] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [verified, setVerified] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      api.saveJobVerifiedFact(jobId, factKey, {
        kind: factKey,
        sourceType: sourceUrl.trim() ? "url" : "manual_verified",
        sourceUrl: sourceUrl.trim() || undefined,
        note: note.trim(),
        verifiedBy: "user",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      setNote("");
      setSourceUrl("");
      setVerified(false);
    },
  });
  const remove = useMutation({
    mutationFn: (key: VerifiedJobFactKey) =>
      api.removeJobVerifiedFact(jobId, key),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  const error = facts.error || save.error || remove.error;
  return (
    <section className="my-4 space-y-3 rounded border p-3">
      <h3 className="font-semibold">Verified job requirements</h3>
      <p className="text-sm text-muted-foreground">
        Unlisted facts are unverified. AI suggestions do not establish these
        requirements.
      </p>
      {facts.data?.map((fact) => (
        <div key={fact.id}>
          <EvidenceSummary evidence={fact.evidence} />
          <Button
            variant="outline"
            size="sm"
            disabled={remove.isPending}
            onClick={() => remove.mutate(fact.factKey)}
          >
            Remove {fact.factKey.replaceAll("_", " ")}
          </Button>
        </div>
      ))}
      {error && <p role="alert">{error.message}</p>}
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (verified && note.trim()) save.mutate();
        }}
      >
        <label className="block">
          Requirement
          <select
            className="ml-2 rounded border bg-background p-2"
            value={factKey}
            onChange={(event) =>
              setFactKey(event.target.value as VerifiedJobFactKey)
            }
          >
            {VERIFIED_JOB_FACT_KEYS.map((key) => (
              <option key={key} value={key}>
                {key.replaceAll("_", " ").toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Source URL (if available)
          <input
            className="block w-full rounded border bg-background p-2"
            type="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
          />
        </label>
        <label className="block">
          Source and supporting statement
          <textarea
            className="block w-full rounded border bg-background p-2"
            required
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Identify the posting, email or document and the exact requirement you verified."
          />
        </label>
        <label className="block text-sm">
          <input
            type="checkbox"
            checked={verified}
            onChange={(event) => setVerified(event.target.checked)}
          />{" "}
          I personally checked this source; this is not an AI classification.
        </label>
        <Button
          type="submit"
          disabled={!verified || !note.trim() || save.isPending}
        >
          Save verified requirement
        </Button>
      </form>
    </section>
  );
}
