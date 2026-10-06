import * as api from "@client/api";
import { PageHeader, PageMain } from "@client/components/layout";
import type { CareerRecommendationSnapshot } from "@shared/types.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CircleHelp, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { buildCareerLearningInsights } from "@/client/lib/career-learning";
import { queryKeys } from "@/client/lib/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Insight = {
  title: string;
  evidence: string;
  recommendation: string;
  action?: { label: string; path: string };
  recommendationKey?: string;
  snapshot?: CareerRecommendationSnapshot;
};

export function ImprovePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const readyQuery = useQuery({
    queryKey: ["candidate-improve", "ready"],
    queryFn: () => api.getJobs({ statuses: ["ready"], view: "list" }),
  });
  const applicationQuery = useQuery({
    queryKey: ["candidate-improve", "applications"],
    queryFn: async () => {
      const response = await api.getJobs({
        statuses: ["applied", "in_progress"],
        view: "list",
      });
      const eventResults = await Promise.allSettled(
        response.jobs.map((job) =>
          queryClient.fetchQuery({
            queryKey: queryKeys.jobs.stageEvents(job.id),
            queryFn: () => api.getJobStageEvents(job.id),
            staleTime: 0,
          }),
        ),
      );
      return {
        applications: response.jobs.map((job, index) => ({
          job,
          events:
            eventResults[index]?.status === "fulfilled"
              ? eventResults[index].value
              : [],
        })),
      };
    },
  });
  const decisionQuery = useQuery({
    queryKey: ["candidate-improve", "recommendation-decisions"],
    queryFn: () => api.listCareerRecommendationDecisions(),
  });
  const decisionMutation = useMutation({
    mutationFn: api.decideCareerRecommendation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["candidate-improve", "recommendation-decisions"],
      });
    },
  });

  const decisionByKey = useMemo(
    () =>
      new Map(
        (decisionQuery.data ?? []).map((decision) => [decision.key, decision]),
      ),
    [decisionQuery.data],
  );

  const insights = useMemo<Insight[]>(() => {
    const ready = readyQuery.data?.jobs ?? [];
    const applicationEvidence = applicationQuery.data?.applications ?? [];
    const applications = applicationEvidence.map(({ job }) => job);
    const jobs = [...ready, ...applications];
    const learningInsights = buildCareerLearningInsights(applicationEvidence);
    const salaryCount = jobs.filter(
      (job) =>
        job.salary ||
        job.salaryMinAmount != null ||
        job.salaryMaxAmount != null,
    ).length;
    const sourceCounts = new Map<string, number>();
    for (const job of jobs) {
      const source = String(job.source || "unknown");
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    }
    const dominant = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const dominantShare =
      dominant && jobs.length ? dominant[1] / jobs.length : 0;

    const result: Insight[] = [
      ...learningInsights.map((insight) => ({
        title: insight.title,
        evidence: insight.evidence + " Confidence: " + insight.confidence + ".",
        recommendation: insight.recommendation,
        recommendationKey: insight.key,
        snapshot: {
          stage: insight.stage,
          confidence: insight.confidence,
          target: insight.target,
          title: insight.title,
          evidence: insight.evidence,
          recommendation: insight.recommendation,
        },
        action:
          insight.target === "mixed" ||
          insight.target === "profile" ||
          insight.target === "job_platform_profile"
            ? { label: "Review profile", path: "/design-resume" }
            : undefined,
      })),
      ...(learningInsights.length === 0
        ? [
            {
              title: "Build outcome evidence before changing strategy",
              evidence:
                String(applications.length) +
                " active or submitted application" +
                (applications.length === 1 ? "" : "s") +
                " are available for calibration.",
              recommendation:
                "The JobAgent will keep learning from applications, employer responses and interview debriefs, but it will not propose a career-direction change from a small sample.",
            },
          ]
        : []),
      {
        title:
          salaryCount >= 5
            ? "Salary evidence is becoming useful"
            : "Salary evidence is still thin",
        evidence:
          String(salaryCount) +
          " current opportunit" +
          (salaryCount === 1 ? "y exposes" : "ies expose") +
          " salary information.",
        recommendation:
          salaryCount >= 5
            ? "This can support salary calibration, but no target will be changed without your confirmation."
            : "No salary-target recommendation will be made until the market sample is large enough.",
        action: { label: "Review profile", path: "/design-resume" },
      },
    ];

    if (dominant && jobs.length >= 5 && dominantShare >= 0.8) {
      result.push({
        title: "Your market view is concentrated in one source",
        evidence:
          dominant[0] +
          " represents " +
          String(Math.round(dominantShare * 100)) +
          "% of the current opportunity sample.",
        recommendation:
          "Review connected channels so one platform does not define your view of the market.",
        action: { label: "Review connections", path: "/settings" },
      });
    } else {
      result.push({
        title: "Cross-platform profile coverage",
        evidence:
          jobs.length === 0
            ? "There is not enough market data to compare sources yet."
            : String(sourceCounts.size) +
              " source" +
              (sourceCounts.size === 1 ? "" : "s") +
              " appear in the current sample.",
        recommendation:
          "LinkedIn, Indeed, Job Bank and employer-site improvements will appear here only when supported by evidence.",
      });
    }

    return result;
  }, [applicationQuery.data, readyQuery.data]);

  const loading =
    readyQuery.isLoading ||
    applicationQuery.isLoading ||
    decisionQuery.isLoading;

  return (
    <>
      <PageHeader
        icon={Sparkles}
        title="Improve"
        subtitle="Use real market response to improve fit, positioning and profile quality"
      />
      <PageMain>
        <section className="mx-auto max-w-5xl space-y-5">
          <div className="rounded-2xl border border-border/60 bg-card/70 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Evidence first</Badge>
              <Badge variant="outline">No silent profile changes</Badge>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              The JobAgent improves quality, not application volume alone
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Recommendations use your profile, matching opportunities,
              application outcomes and interview evidence. You decide whether to
              use a recommendation. Profile and strategy changes stay under your
              control.
            </p>
          </div>

          {loading ? (
            <div className="rounded-xl border border-border/60 p-8 text-center text-sm text-muted-foreground">
              Building your evidence snapshot…
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {insights.map((insight) => {
                const decision = insight.recommendationKey
                  ? decisionByKey.get(insight.recommendationKey)
                  : null;
                return (
                  <article
                    key={insight.title}
                    className="rounded-xl border border-border/60 bg-card/70 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <CircleHelp className="h-4 w-4" />
                      <h2 className="font-semibold">{insight.title}</h2>
                      {insight.snapshot ? (
                        <Badge variant="outline">
                          {insight.snapshot.confidence}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Evidence
                    </div>
                    <p className="mt-1 text-sm">{insight.evidence}</p>
                    <div className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      The JobAgent suggestion
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {insight.recommendation}
                    </p>

                    {insight.recommendationKey && insight.snapshot ? (
                      <div className="mt-4 border-t border-border/50 pt-3">
                        {decision ? (
                          <div className="space-y-2">
                            <Badge
                              variant={
                                decision.status === "accepted"
                                  ? "default"
                                  : "outline"
                              }
                            >
                              {decision.status === "accepted"
                                ? "Accepted for review"
                                : "Current approach kept"}
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              {decision.status === "accepted"
                                ? "No profile or strategy was changed automatically. The recommendation is saved as an explicit user decision."
                                : "TJAgent will keep the evidence, but this recommendation will not be treated as an approved change."}
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={decisionMutation.isPending}
                              onClick={() =>
                                decisionMutation.mutate({
                                  key: insight.recommendationKey as string,
                                  snapshot:
                                    insight.snapshot as CareerRecommendationSnapshot,
                                  status: "accepted",
                                })
                              }
                            >
                              Use this recommendation
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={decisionMutation.isPending}
                              onClick={() =>
                                decisionMutation.mutate({
                                  key: insight.recommendationKey as string,
                                  snapshot:
                                    insight.snapshot as CareerRecommendationSnapshot,
                                  status: "rejected",
                                })
                              }
                            >
                              Keep current approach
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {insight.action ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() =>
                          insight.action && navigate(insight.action.path)
                        }
                      >
                        {insight.action.label}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    ) : null}
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
