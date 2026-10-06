import * as api from "@client/api";
import { PageHeader, PageMain } from "@client/components/layout";
import type { JobListItem } from "@shared/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  ExternalLink,
  FileCheck2,
  SlidersHorizontal,
} from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PERIOD_OPTIONS = [
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
] as const;

function isWithinPeriod(job: JobListItem, hours: number): boolean {
  const discoveredAt = Date.parse(job.discoveredAt);
  if (!Number.isFinite(discoveredAt)) return true;
  return discoveredAt >= Date.now() - hours * 60 * 60 * 1000;
}

function salaryLabel(job: JobListItem): string | null {
  if (job.salary) return job.salary;
  if (job.salaryMinAmount == null && job.salaryMaxAmount == null) return null;
  const currency = job.salaryCurrency ? ` ${job.salaryCurrency}` : "";
  if (job.salaryMinAmount != null && job.salaryMaxAmount != null) {
    return `${job.salaryMinAmount.toLocaleString()} – ${job.salaryMaxAmount.toLocaleString()}${currency}`;
  }
  const value = job.salaryMinAmount ?? job.salaryMaxAmount;
  return value == null ? null : `${value.toLocaleString()}${currency}`;
}

export function CandidateHomePage() {
  const navigate = useNavigate();
  const [periodHours, setPeriodHours] = React.useState(24);

  const jobsQuery = useQuery({
    queryKey: ["candidate-home", "ready-jobs"],
    queryFn: () => api.getJobs({ statuses: ["ready"], view: "list" }),
    refetchInterval: 60_000,
  });

  const prepareMutation = useMutation({
    mutationFn: (jobId: string) => api.prepareApplicationPackageForJob(jobId),
    onSuccess: (result) => {
      navigate("/applications/package/" + result.applicationPackage.id);
    },
    onError: (error, jobId) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not prepare the application package.",
        {
          action: {
            label: "Review vacancy",
            onClick: () => navigate("/job/" + jobId),
          },
        },
      );
    },
  });

  const jobs = React.useMemo(
    () =>
      (jobsQuery.data?.jobs ?? [])
        .filter((job) => isWithinPeriod(job, periodHours))
        .sort(
          (a, b) =>
            (b.suitabilityScore ?? -1) - (a.suitabilityScore ?? -1) ||
            Date.parse(b.discoveredAt) - Date.parse(a.discoveredAt),
        ),
    [jobsQuery.data, periodHours],
  );

  return (
    <>
      <PageHeader
        icon={BriefcaseBusiness}
        title="Today"
        subtitle="Your best new opportunities, ready to act on"
        actions={
          <>
            <div className="flex rounded-md border border-border/60 p-0.5">
              {PERIOD_OPTIONS.map((option) => (
                <Button
                  key={option.hours}
                  type="button"
                  size="sm"
                  variant={periodHours === option.hours ? "secondary" : "ghost"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setPeriodHours(option.hours)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/settings")}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Adjust
            </Button>
          </>
        }
      />

      <PageMain>
        <section className="mx-auto max-w-5xl space-y-5">
          <div className="rounded-2xl border border-border/60 bg-card/70 p-5">
            <div className="text-sm text-muted-foreground">
              Pathfinder found
            </div>
            <div className="mt-1 text-3xl font-semibold tracking-tight">
              {jobs.length} {jobs.length === 1 ? "match" : "matches"}
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              These vacancies passed your current search and scoring rules. Open
              the original posting or prepare an application package.
            </p>
          </div>

          {jobsQuery.isLoading ? (
            <div className="rounded-xl border border-border/60 p-8 text-center text-sm text-muted-foreground">
              Loading your latest matches…
            </div>
          ) : jobsQuery.error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              Could not load matches. Please try again shortly.
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-card/50 p-10 text-center">
              <div className="text-base font-medium">
                No new matches in this period
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Monitoring can keep running in the background. You can widen the
                period or adjust what you are looking for.
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => navigate("/settings")}
              >
                Adjust my search
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => {
                const salary = salaryLabel(job);
                const sourceUrl = job.applicationLink || job.jobUrl;
                return (
                  <article
                    key={job.id}
                    className="rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => navigate("/job/" + job.id)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold">
                            {job.title}
                          </h2>
                          {typeof job.suitabilityScore === "number" ? (
                            <Badge variant="secondary">
                              {job.suitabilityScore}% fit
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {job.employer}
                          {job.location ? " · " + job.location : ""}
                        </div>
                        {salary ? (
                          <div className="mt-2 text-sm font-medium">
                            {salary}
                          </div>
                        ) : null}
                      </button>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {sourceUrl ? (
                          <Button
                            asChild
                            type="button"
                            variant="outline"
                            size="sm"
                          >
                            <a
                              href={sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Posting
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          disabled={prepareMutation.isPending}
                          onClick={() => prepareMutation.mutate(job.id)}
                        >
                          <FileCheck2 className="h-4 w-4" />
                          Prepare application
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </PageMain>
    </>
  );
}
