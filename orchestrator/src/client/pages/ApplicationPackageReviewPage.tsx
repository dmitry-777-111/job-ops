import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  approveApplicationPackage,
  getApplicationPackageReview,
} from "@/client/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type TargetedCvPreview = {
  basics?: {
    name?: string;
    headline?: string;
    label?: string;
  };
  sections?: {
    skills?: {
      items?: Array<{
        id?: string;
        name?: string;
      }>;
    };
  };
};

function coverageLabel(state: "verified" | "gap" | "unmapped"): string {
  if (state === "verified") return "Verified";
  if (state === "gap") return "Gap";
  return "Needs review";
}

export function ApplicationPackageReviewPage() {
  const { applicationPackageId } = useParams<{
    applicationPackageId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [acknowledgeUnknown, setAcknowledgeUnknown] = React.useState(false);

  const reviewQuery = useQuery({
    queryKey: [
      "application-package-review",
      applicationPackageId ?? null,
      acknowledgeUnknown,
    ],
    queryFn: () =>
      getApplicationPackageReview(applicationPackageId ?? "", {
        acknowledgeUnknownLiveState: acknowledgeUnknown,
      }),
    enabled: Boolean(applicationPackageId),
    retry: false,
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      approveApplicationPackage(applicationPackageId ?? "", {
        acknowledgeUnknownLiveState: acknowledgeUnknown,
      }),
    onSuccess: async () => {
      toast.success("Application package approved.");
      await queryClient.invalidateQueries({
        queryKey: ["application-package-review", applicationPackageId],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not approve the application package.",
      );
    },
  });

  if (!applicationPackageId) return null;

  if (reviewQuery.isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-sm text-muted-foreground">
          Loading application package???
        </p>
      </main>
    );
  }

  if (reviewQuery.error || !reviewQuery.data) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          {reviewQuery.error instanceof Error
            ? reviewQuery.error.message
            : "Application package not found."}
        </div>
      </main>
    );
  }

  const review = reviewQuery.data;
  const applicationPackage = review.applicationPackage;
  const targetedCv =
    (applicationPackage.targetedCvJson as TargetedCvPreview | null) ?? null;
  const targetedSkills = targetedCv?.sections?.skills?.items ?? [];
  const isApproved =
    applicationPackage.status === "approved" ||
    applicationPackage.status === "exported";
  const unknownNeedsAcknowledgement =
    review.liveGate.state === "unknown" && !acknowledgeUnknown;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Application package v{applicationPackage.version}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {review.posting.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {review.posting.employer}
            {review.posting.location ? " - " + review.posting.location : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Vacancy: {review.liveGate.state}</Badge>
          <Badge variant={review.qa.pass ? "secondary" : "destructive"}>
            QA: {review.qa.pass ? "Pass" : "Blocked"}
          </Badge>
          <Badge variant="outline">{applicationPackage.status}</Badge>
        </div>
      </div>

      {review.liveGate.state === "unknown" && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-border/50 bg-card/75 p-4 text-sm">
          <Checkbox
            id="application-review-unknown-live"
            checked={acknowledgeUnknown}
            onCheckedChange={(checked) =>
              setAcknowledgeUnknown(checked === true)
            }
          />
          <label htmlFor="application-review-unknown-live">
            The current vacancy status cannot be verified. I understand this and
            want to continue reviewing and approving this package.
          </label>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border/50 bg-card/75 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Requirement coverage</h2>
          </div>
          <div className="mt-4 space-y-3">
            {review.requirementCoverage.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No explicit required or preferred statements were extracted from
                the pinned vacancy version.
              </p>
            )}
            {review.requirementCoverage.map((item) => (
              <div
                key={item.requirement.key}
                className="rounded-lg border border-border/50 bg-background/25 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm">{item.requirement.text}</p>
                  <Badge variant="outline">{coverageLabel(item.state)}</Badge>
                </div>
                {item.evidence && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Evidence: {item.evidence.evidenceText}
                  </p>
                )}
                {item.gap && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.gap.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border/50 bg-card/75 p-4">
          <h2 className="font-semibold">Targeted CV preview</h2>
          <div className="mt-4 rounded-lg border border-border/50 bg-background/25 p-3">
            <div className="text-base font-medium">
              {targetedCv?.basics?.name || "Candidate"}
            </div>
            {(targetedCv?.basics?.headline || targetedCv?.basics?.label) && (
              <div className="mt-1 text-sm text-muted-foreground">
                {targetedCv.basics?.headline || targetedCv.basics?.label}
              </div>
            )}
            {targetedSkills.length > 0 && (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Skills ordered for this vacancy
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {targetedSkills.map((skill, index) => (
                    <Badge
                      key={skill.id || skill.name || String(index)}
                      variant="secondary"
                    >
                      {skill.name || "Skill"}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Changes from master
            </div>
            {review.changedFromMaster.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No candidate facts were changed.
              </p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {review.changedFromMaster.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-border/50 bg-card/75 p-4">
        <h2 className="font-semibold">Cover letter preview</h2>
        <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-border/50 bg-background/25 p-4 font-sans text-sm leading-6">
          {applicationPackage.coverLetter || "No cover letter generated."}
        </pre>
      </section>

      {!review.qa.pass && (
        <section className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <h2 className="font-semibold">Approval blockers</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {review.qa.blockingIssues.map((issue) => (
              <li key={issue}>{issue.replaceAll("_", " ")}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/75 p-4">
        <div className="text-sm text-muted-foreground">
          {review.qa.hardGapCount} hard gap(s), {review.qa.gapCount} total
          gap(s)
        </div>
        <Button
          type="button"
          disabled={
            isApproved ||
            !review.qa.pass ||
            unknownNeedsAcknowledgement ||
            approveMutation.isPending
          }
          onClick={() => approveMutation.mutate()}
        >
          <CheckCircle2 className="h-4 w-4" />
          {isApproved
            ? "Approved"
            : approveMutation.isPending
              ? "Approving???"
              : "Approve package"}
        </Button>
      </div>
    </main>
  );
}
