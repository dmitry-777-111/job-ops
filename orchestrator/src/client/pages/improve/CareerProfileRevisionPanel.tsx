import * as api from "@client/api";
import type {
  CareerRecommendationSnapshot,
  MasterCareerProfileVersion,
  ResumeProfile,
} from "@shared/types.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function cloneProfile(profile: ResumeProfile): ResumeProfile {
  return JSON.parse(JSON.stringify(profile)) as ResumeProfile;
}

function normalize(value: string | undefined) {
  return value?.trim() ?? "";
}

export function CareerProfileRevisionPanel({
  recommendationKey,
  snapshot,
  onClose,
}: {
  recommendationKey: string;
  snapshot: CareerRecommendationSnapshot;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const activeProfileQuery = useQuery({
    queryKey: ["candidate", "profile", "active"],
    queryFn: api.getActiveMasterCareerProfile,
  });

  const [label, setLabel] = React.useState("");
  const [headline, setHeadline] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [draft, setDraft] = React.useState<MasterCareerProfileVersion | null>(
    null,
  );
  const [aiRationale, setAiRationale] = React.useState<string[]>([]);
  const [aiCaveat, setAiCaveat] = React.useState<string | null>(null);
  const [activatedVersion, setActivatedVersion] = React.useState<number | null>(
    null,
  );

  React.useEffect(() => {
    const active = activeProfileQuery.data;
    if (!active) return;
    setLabel(active.profile.basics?.label ?? "");
    setHeadline(active.profile.basics?.headline ?? "");
    setSummary(
      active.profile.basics?.summary ??
        active.profile.sections?.summary?.content ??
        "",
    );
  }, [activeProfileQuery.data]);

  const active = activeProfileQuery.data;

  const changedFields = active
    ? [
        normalize(active.profile.basics?.label) !== normalize(label)
          ? "Professional label"
          : null,
        normalize(active.profile.basics?.headline) !== normalize(headline)
          ? "Headline"
          : null,
        normalize(
          active.profile.basics?.summary ??
            active.profile.sections?.summary?.content,
        ) !== normalize(summary)
          ? "Summary"
          : null,
      ].filter(Boolean)
    : [];

  const suggestionMutation = useMutation({
    mutationFn: () =>
      api.suggestCareerProfileRevision({
        key: recommendationKey,
        snapshot,
      }),
    onSuccess: (suggestion) => {
      if (suggestion.label != null) setLabel(suggestion.label);
      if (suggestion.headline != null) setHeadline(suggestion.headline);
      if (suggestion.summary != null) setSummary(suggestion.summary);
      setAiRationale(suggestion.rationale);
      setAiCaveat(suggestion.caveat);
    },
  });

  const createDraftMutation = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error("No active career profile is available.");
      if (changedFields.length === 0) {
        throw new Error(
          "Change at least one profile field before creating a draft.",
        );
      }

      const profile = cloneProfile(active.profile);
      profile.basics = {
        ...(profile.basics ?? {}),
        label: normalize(label) || undefined,
        headline: normalize(headline) || undefined,
        summary: normalize(summary) || undefined,
      };
      if (profile.sections?.summary) {
        profile.sections = {
          ...profile.sections,
          summary: {
            ...profile.sections.summary,
            content: normalize(summary),
          },
        };
      }

      return api.createMasterCareerProfileDraft({
        profile,
        sourceRef: `career-recommendation:${recommendationKey}`,
        provenance: {
          source: "career_learning_loop",
          recommendationKey,
          recommendationTitle: snapshot.title,
          recommendationEvidence: snapshot.evidence,
          recommendationConfidence: snapshot.confidence,
          recommendationTarget: snapshot.target,
          userApprovedRecommendation: true,
        },
      });
    },
    onSuccess: (result) => {
      setDraft(result);
      setActivatedVersion(null);
    },
  });

  const activateMutation = useMutation({
    mutationFn: (versionId: string) =>
      api.activateMasterCareerProfileVersion(versionId),
    onSuccess: async (result) => {
      setActivatedVersion(result.version);
      await queryClient.invalidateQueries({
        queryKey: ["candidate", "profile", "active"],
      });
    },
  });

  if (activeProfileQuery.isLoading) {
    return (
      <div className="rounded-xl border border-border/60 p-4 text-sm text-muted-foreground">
        Loading current career profile…
      </div>
    );
  }

  if (!active) {
    return (
      <div className="rounded-xl border border-border/60 p-4">
        <p className="text-sm font-medium">No active career profile yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          TJAgent will not create or activate a profile revision without an
          existing active profile.
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
        <h3 className="font-semibold">Prepare a career profile revision</h3>
        <Badge variant="outline">Current v{active.version}</Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Edit only the positioning fields you want to test. Experience, skills,
        projects, education and other profile evidence are preserved unchanged.
        Creating a draft does not activate it.
      </p>

      <div className="mt-4">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={suggestionMutation.isPending}
          onClick={() => suggestionMutation.mutate()}
        >
          {suggestionMutation.isPending
            ? "Preparing wording…"
            : "Suggest wording with AI"}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          TJAgent may rewrite positioning, but it must not invent experience,
          credentials or skills. Review every suggestion before creating a
          draft.
        </p>
        {suggestionMutation.error ? (
          <p className="mt-2 text-sm text-destructive">
            {suggestionMutation.error instanceof Error
              ? suggestionMutation.error.message
              : "Could not generate wording suggestions."}
          </p>
        ) : null}
        {aiRationale.length > 0 || aiCaveat ? (
          <div className="mt-3 rounded-lg border border-border/50 bg-card/60 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Why TJAgent suggests this
            </div>
            {aiRationale.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {aiRationale.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
            {aiCaveat ? (
              <p className="mt-2 text-xs text-muted-foreground">{aiCaveat}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3">
        <label htmlFor="career-profile-label" className="grid gap-1 text-sm">
          <span className="font-medium">Professional label</span>
          <Input
            id="career-profile-label"
            aria-label="Professional label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <label htmlFor="career-profile-headline" className="grid gap-1 text-sm">
          <span className="font-medium">Headline</span>
          <Input
            id="career-profile-headline"
            aria-label="Headline"
            value={headline}
            onChange={(event) => setHeadline(event.target.value)}
          />
        </label>
        <label htmlFor="career-profile-summary" className="grid gap-1 text-sm">
          <span className="font-medium">Summary</span>
          <Textarea
            id="career-profile-summary"
            aria-label="Summary"
            rows={6}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 rounded-lg border border-border/50 bg-card/60 p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Preview
        </div>
        {changedFields.length > 0 ? (
          <p className="mt-2 text-sm">
            New draft will change: {changedFields.join(", ")}.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No profile fields changed yet.
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          This updates the internal Master Career Profile only. LinkedIn, Indeed
          and other job-platform profiles are never edited automatically.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={createDraftMutation.isPending}
          onClick={() => createDraftMutation.mutate()}
        >
          {createDraftMutation.isPending ? "Creating…" : "Create profile draft"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>

      {createDraftMutation.error ? (
        <p className="mt-3 text-sm text-destructive">
          {createDraftMutation.error instanceof Error
            ? createDraftMutation.error.message
            : "Could not create profile draft."}
        </p>
      ) : null}

      {draft ? (
        <div className="mt-5 rounded-lg border border-border/50 bg-card/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Draft v{draft.version}</span>
            <Badge variant="outline">not active</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            The previous profile remains active until you explicitly activate
            this version.
          </p>

          {activatedVersion === draft.version ? (
            <p className="mt-4 text-sm font-medium">
              Career profile v{activatedVersion} is now active.
            </p>
          ) : (
            <Button
              type="button"
              size="sm"
              className="mt-4"
              disabled={activateMutation.isPending}
              onClick={() => activateMutation.mutate(draft.id)}
            >
              {activateMutation.isPending
                ? "Activating…"
                : "Activate this profile version"}
            </Button>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Activation is explicit. TJAgent never activates a profile draft on
            its own.
          </p>
        </div>
      ) : null}
    </section>
  );
}
