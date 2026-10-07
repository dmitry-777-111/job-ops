import * as api from "@client/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PendingOutcomeConfirmation } from "@/client/lib/outcome-confirmation";
import { queryKeys } from "@/client/lib/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function userEvidence(kind: "interview" | "rejection", note: string) {
  return {
    kind,
    sourceType: "manual_verified" as const,
    verifiedBy: "user" as const,
    note,
  };
}

export function OutcomeConfirmationCard({
  pending,
  onResolved,
}: {
  pending: PendingOutcomeConfirmation;
  onResolved?: () => void;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (decision: "advanced" | "rejected" | "waiting") => {
      const jobId = pending.job.id;
      if (decision === "advanced") {
        return api.transitionJobStage(jobId, {
          toStage: pending.nextStage,
          metadata: {
            actor: "user",
            eventType: "status_update",
            note: "User confirmed that the employer moved the application to the next hiring stage.",
            evidence: userEvidence(
              "interview",
              "User personally confirmed a next hiring stage after the prior interview.",
            ),
          },
        });
      }
      if (decision === "rejected") {
        return api.transitionJobStage(jobId, {
          toStage: "closed",
          outcome: "rejected",
          metadata: {
            actor: "user",
            eventType: "status_update",
            note: "User confirmed employer rejection after interview.",
            evidence: userEvidence(
              "rejection",
              "User personally confirmed the employer rejection.",
            ),
          },
        });
      }
      return api.transitionJobStage(jobId, {
        toStage: "no_change",
        metadata: {
          actor: "user",
          eventType: "note",
          outcomeCheck: "waiting",
          note: "User confirmed that the interview outcome is still pending.",
        },
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["candidate-improve", "applications"],
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.jobs.stageEvents(pending.job.id),
        }),
      ]);
      onResolved?.();
    },
  });

  return (
    <section className="rounded-xl border border-border/60 bg-card/80 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Outcome check</Badge>
        <span className="text-sm font-medium">{pending.job.employer}</span>
      </div>
      <p className="mt-2 text-sm">
        After your {pending.interviewEvent.title.toLowerCase()}, what happened?
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        TJAgent will not treat an unresolved interview as a rejection.
        Confirming the real outcome keeps Career Learning evidence accurate.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("advanced")}
        >
          Next stage
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("rejected")}
        >
          Rejected
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("waiting")}
        >
          Still waiting
        </Button>
      </div>
      {mutation.error ? (
        <p className="mt-3 text-sm text-destructive">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Could not save the interview outcome."}
        </p>
      ) : null}
    </section>
  );
}
