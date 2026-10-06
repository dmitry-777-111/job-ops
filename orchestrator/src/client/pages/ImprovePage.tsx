import * as api from "@client/api";
import { PageHeader, PageMain } from "@client/components/layout";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CircleHelp, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Insight = {
  title: string;
  evidence: string;
  recommendation: string;
  action?: { label: string; path: string };
};

export function ImprovePage() {
  const navigate = useNavigate();
  const readyQuery = useQuery({
    queryKey: ["candidate-improve", "ready"],
    queryFn: () => api.getJobs({ statuses: ["ready"], view: "list" }),
  });
  const applicationQuery = useQuery({
    queryKey: ["candidate-improve", "applications"],
    queryFn: () =>
      api.getJobs({ statuses: ["applied", "in_progress"], view: "list" }),
  });

  const insights = useMemo<Insight[]>(() => {
    const ready = readyQuery.data?.jobs ?? [];
    const applications = applicationQuery.data?.jobs ?? [];
    const jobs = [...ready, ...applications];
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
      {
        title:
          applications.length >= 5
            ? "Outcome evidence is ready for review"
            : "Build outcome evidence before changing strategy",
        evidence:
          String(applications.length) +
          " active or submitted application" +
          (applications.length === 1 ? "" : "s") +
          " are available for calibration.",
        recommendation:
          applications.length >= 5
            ? "Pathfinder can start comparing response quality by role, source, geography and compensation."
            : "Pathfinder will avoid strong salary or positioning conclusions until the outcome sample is larger.",
      },
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

  const loading = readyQuery.isLoading || applicationQuery.isLoading;

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
              Pathfinder improves quality, not application volume alone
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Recommendations use your profile, matching opportunities and
              application outcomes. Strategy changes stay under your control.
            </p>
          </div>

          {loading ? (
            <div className="rounded-xl border border-border/60 p-8 text-center text-sm text-muted-foreground">
              Building your evidence snapshot…
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {insights.map((insight) => (
                <article
                  key={insight.title}
                  className="rounded-xl border border-border/60 bg-card/70 p-5"
                >
                  <div className="flex items-center gap-2">
                    <CircleHelp className="h-4 w-4" />
                    <h2 className="font-semibold">{insight.title}</h2>
                  </div>
                  <div className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Evidence
                  </div>
                  <p className="mt-1 text-sm">{insight.evidence}</p>
                  <div className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pathfinder suggestion
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {insight.recommendation}
                  </p>
                  {insight.action ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => navigate(insight.action!.path)}
                    >
                      {insight.action.label}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </PageMain>
    </>
  );
}
