import { useMutation, useQuery } from "@tanstack/react-query";
import { FileCheck2 } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  getApplicationPackageJobFlow,
  prepareApplicationPackageForJob,
} from "@/client/api";
import { ApiClientError } from "@/client/api/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function ApplicationPackagePanel({ jobId }: { jobId: string }) {
  const navigate = useNavigate();
  const [acknowledgeUnknown, setAcknowledgeUnknown] = React.useState(false);

  const flowQuery = useQuery({
    queryKey: ["application-package-job-flow", jobId],
    queryFn: () => getApplicationPackageJobFlow(jobId),
    retry: false,
  });

  const prepareMutation = useMutation({
    mutationFn: () =>
      prepareApplicationPackageForJob(jobId, {
        acknowledgeUnknownLiveState: acknowledgeUnknown,
      }),
    onSuccess: (result) => {
      navigate("/applications/package/" + result.applicationPackage.id);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not prepare the application package.",
      );
    },
  });

  if (
    flowQuery.error instanceof ApiClientError &&
    flowQuery.error.status === 404
  ) {
    return null;
  }

  if (flowQuery.isLoading) {
    return (
      <article className="rounded-xl border border-border/50 bg-card/75 p-4">
        <div className="text-sm text-muted-foreground">
          Checking application package readiness???
        </div>
      </article>
    );
  }

  const flow = flowQuery.data;
  if (!flow) return null;

  const latestPackage = flow.applicationPackages[0] ?? null;
  const liveState = flow.liveGate.state;
  const isClosed = liveState === "closed";
  const needsUnknownAcknowledgement =
    liveState === "unknown" && !acknowledgeUnknown;

  return (
    <article className="rounded-xl border border-border/50 bg-card/75 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileCheck2 className="h-4 w-4 text-primary" />
            Application package
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Truth-checked targeted CV, cover letter, requirement coverage and
            approval.
          </p>
        </div>
        <Badge variant={liveState === "live" ? "secondary" : "outline"}>
          Vacancy: {liveState}
        </Badge>
      </div>

      {latestPackage && (
        <div className="mt-4 rounded-lg border border-border/50 bg-background/25 p-3 text-sm">
          Latest package: version {latestPackage.version} ??{" "}
          {latestPackage.status}
        </div>
      )}

      {liveState === "unknown" && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-border/50 bg-background/25 p-3 text-sm">
          <Checkbox
            id="application-package-unknown-live"
            checked={acknowledgeUnknown}
            onCheckedChange={(checked) =>
              setAcknowledgeUnknown(checked === true)
            }
          />
          <label htmlFor="application-package-unknown-live">
            The current vacancy status cannot be verified. I want to prepare the
            package anyway.
          </label>
        </div>
      )}

      {isClosed && (
        <p className="mt-4 text-sm text-muted-foreground">
          Package creation is blocked because authoritative evidence marks this
          vacancy as closed.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {latestPackage && (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              navigate("/applications/package/" + latestPackage.id)
            }
          >
            Review latest package
          </Button>
        )}
        <Button
          type="button"
          disabled={
            isClosed || needsUnknownAcknowledgement || prepareMutation.isPending
          }
          onClick={() => prepareMutation.mutate()}
        >
          {prepareMutation.isPending
            ? "Preparing???"
            : latestPackage
              ? "Prepare new version"
              : "Prepare application"}
        </Button>
      </div>
    </article>
  );
}
