import * as api from "@client/api";
import type {
  CandidateStrategyDelta,
  CandidateStrategyProfile,
  CareerRecommendationSnapshot,
} from "@shared/types.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinCsv(values: string[]) {
  return values.join(", ");
}

function appendRecommendationNote(
  current: string | null | undefined,
  key: string,
  snapshot: CareerRecommendationSnapshot,
) {
  const audit = [
    `TJAgent recommendation accepted for review: ${key}`,
    `Title: ${snapshot.title}`,
    `Evidence: ${snapshot.evidence}`,
    `Suggestion: ${snapshot.recommendation}`,
  ].join("\n");
  return [current?.trim(), audit].filter(Boolean).join("\n\n");
}

export function CareerStrategyRevisionPanel({
  recommendationKey,
  snapshot,
  onClose,
}: {
  recommendationKey: string;
  snapshot: CareerRecommendationSnapshot;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const activeStrategyQuery = useQuery({
    queryKey: ["candidate", "strategy", "active"],
    queryFn: api.getActiveCandidateStrategy,
  });

  const [markets, setMarkets] = React.useState("");
  const [roles, setRoles] = React.useState("");
  const [excludedRoles, setExcludedRoles] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [draftResult, setDraftResult] = React.useState<{
    draft: CandidateStrategyProfile;
    delta: CandidateStrategyDelta;
  } | null>(null);
  const [activatedVersion, setActivatedVersion] = React.useState<number | null>(
    null,
  );

  React.useEffect(() => {
    const active = activeStrategyQuery.data;
    if (!active) return;
    setMarkets(joinCsv(active.targetMarkets));
    setRoles(joinCsv(active.targetRoleFamilies));
    setExcludedRoles(joinCsv(active.excludedRoleFamilies));
    setNotes(active.freeformNotes ?? "");
  }, [activeStrategyQuery.data]);

  const createDraftMutation = useMutation({
    mutationFn: async () => {
      const active = activeStrategyQuery.data;
      if (!active) throw new Error("No active strategy is available.");
      const draft = await api.createCandidateStrategyDraft({
        targetMarkets: splitCsv(markets),
        targetRoleFamilies: splitCsv(roles),
        excludedRoleFamilies: splitCsv(excludedRoles),
        constraints: active.constraints,
        freeformNotes: appendRecommendationNote(
          notes,
          recommendationKey,
          snapshot,
        ),
      });
      const delta = await api.getCandidateStrategyDelta(draft.id);
      return { draft, delta };
    },
    onSuccess: (result) => {
      setDraftResult(result);
      setActivatedVersion(null);
    },
  });

  const activateMutation = useMutation({
    mutationFn: (versionId: string) =>
      api.activateCandidateStrategyVersion(versionId),
    onSuccess: async (activated) => {
      setActivatedVersion(activated.version);
      await queryClient.invalidateQueries({
        queryKey: ["candidate", "strategy", "active"],
      });
    },
  });

  if (activeStrategyQuery.isLoading) {
    return (
      <div className="rounded-xl border border-border/60 p-4 text-sm text-muted-foreground">
        Loading current strategy…
      </div>
    );
  }

  const active = activeStrategyQuery.data;
  if (!active) {
    return (
      <div className="rounded-xl border border-border/60 p-4">
        <p className="text-sm font-medium">No active strategy yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          TJAgent will not create or activate a strategy without an existing
          candidate strategy to review.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-border/60 bg-muted/10 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">Prepare a strategy revision</h3>
        <Badge variant="outline">Current v{active.version}</Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Edit only what you want to change. Hard/contextual constraints are
        copied unchanged. Creating a draft does not activate it.
      </p>

      <div className="mt-4 grid gap-3">
        <label htmlFor="strategy-target-markets" className="grid gap-1 text-sm">
          <span className="font-medium">Target markets</span>
          <Input
            id="strategy-target-markets"
            aria-label="Target markets"
            value={markets}
            onChange={(event) => setMarkets(event.target.value)}
            placeholder="canada, alberta, ontario"
          />
        </label>
        <label htmlFor="strategy-target-roles" className="grid gap-1 text-sm">
          <span className="font-medium">Target role families</span>
          <Input
            id="strategy-target-roles"
            aria-label="Target role families"
            value={roles}
            onChange={(event) => setRoles(event.target.value)}
            placeholder="field service, commissioning"
          />
        </label>
        <label htmlFor="strategy-excluded-roles" className="grid gap-1 text-sm">
          <span className="font-medium">Excluded role families</span>
          <Input
            id="strategy-excluded-roles"
            aria-label="Excluded role families"
            value={excludedRoles}
            onChange={(event) => setExcludedRoles(event.target.value)}
          />
        </label>
        <label htmlFor="strategy-notes" className="grid gap-1 text-sm">
          <span className="font-medium">Strategy notes</span>
          <Textarea
            id="strategy-notes"
            aria-label="Strategy notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={createDraftMutation.isPending}
          onClick={() => createDraftMutation.mutate()}
        >
          {createDraftMutation.isPending ? "Creating…" : "Create draft"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>

      {createDraftMutation.error ? (
        <p className="mt-3 text-sm text-destructive">
          {createDraftMutation.error instanceof Error
            ? createDraftMutation.error.message
            : "Could not create strategy draft."}
        </p>
      ) : null}

      {draftResult ? (
        <div className="mt-5 rounded-lg border border-border/50 bg-card/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              Draft v{draftResult.draft.version}
            </span>
            <Badge variant="outline">not active</Badge>
          </div>
          <div className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Review delta
          </div>
          <div className="mt-2 space-y-1 text-sm">
            <p>
              Added constraints: {draftResult.delta.added.length}; changed:{" "}
              {draftResult.delta.changed.length}; removed:{" "}
              {draftResult.delta.removedConstraintIds.length}
            </p>
            {draftResult.delta.likelySearchImpact.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {draftResult.delta.likelySearchImpact.map((impact) => (
                  <li key={impact}>{impact}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                No automatic search-impact inference was produced.
              </p>
            )}
          </div>

          {activatedVersion === draftResult.draft.version ? (
            <p className="mt-4 text-sm font-medium">
              Strategy v{activatedVersion} is now active.
            </p>
          ) : (
            <Button
              type="button"
              size="sm"
              className="mt-4"
              disabled={activateMutation.isPending}
              onClick={() => activateMutation.mutate(draftResult.draft.id)}
            >
              {activateMutation.isPending
                ? "Activating…"
                : "Activate this version"}
            </Button>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Activation is explicit. TJAgent never activates a draft on its own.
          </p>
        </div>
      ) : null}
    </section>
  );
}
