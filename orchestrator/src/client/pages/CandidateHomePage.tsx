import * as api from "@client/api";
import { PageHeader, PageMain } from "@client/components/layout";
import type { JobListItem } from "@shared/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  SlidersHorizontal,
  Sparkles,
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

const JOURNEY_STAGES = [
  "Tell us about yourself",
  "Tell us what you want",
  "Receive suitable jobs",
  "Get an application-ready package",
  "Improve from real outcomes",
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
  const applicationsQuery = useQuery({
    queryKey: ["candidate-home", "applications"],
    queryFn: () =>
      api.getJobs({ statuses: ["applied", "in_progress"], view: "list" }),
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
  const applicationCount = applicationsQuery.data?.jobs.length ?? 0;
  const adaptiveMode =
    applicationCount >= 5
      ? "learn"
      : applicationCount > 0
        ? "review"
        : jobs.length > 0
          ? "apply"
          : "search";
  const adaptiveMessage =
    adaptiveMode === "learn"
      ? "You have enough application activity to start learning from market response."
      : adaptiveMode === "review"
        ? "You have active applications. Review progress while The JobAgent keeps searching."
        : adaptiveMode === "apply"
          ? "Strong matches are ready. The best next action is to review and prepare applications."
          : "The JobAgent is building market evidence and watching for stronger matches.";

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
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4" />
                  Your The JobAgent journey
                </div>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  {adaptiveMessage}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate("/improve")}
              >
                Improve my profile
              </Button>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {JOURNEY_STAGES.map((stage, index) => {
                const completed =
                  index < 2 ||
                  (index === 2 && jobs.length > 0) ||
                  (index === 3 && applicationCount > 0);
                const active =
                  (adaptiveMode === "search" && index === 2) ||
                  (adaptiveMode === "apply" && index === 2) ||
                  (adaptiveMode === "review" && index === 3) ||
                  (adaptiveMode === "learn" && index === 4);
                return (
                  <div
                    key={stage}
                    className={
                      "rounded-xl border p-3 text-sm " +
                      (active
                        ? "border-foreground/30 bg-foreground text-background"
                        : "border-border/60 bg-background/40")
                    }
                  >
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide opacity-80">
                      {completed ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : null}
                      Step {index + 1}
                    </div>
                    <div className="mt-2 font-medium">{stage}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/70 p-5">
            <div className="text-sm text-muted-foreground">
              The JobAgent found
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
