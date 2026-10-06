import type {
  CareerLearningStage,
  CareerRecommendationConfidence,
  CareerRecommendationTarget,
  JobListItem,
  StageEvent,
} from "@shared/types.js";

export type CareerLearningInsight = {
  key: string;
  stage: CareerLearningStage;
  confidence: CareerRecommendationConfidence;
  target: CareerRecommendationTarget;
  title: string;
  evidence: string;
  recommendation: string;
};

export type CareerLearningApplication = {
  job: JobListItem;
  events: StageEvent[];
};

const RESPONSE_STAGES = new Set([
  "recruiter_screen",
  "assessment",
  "hiring_manager_screen",
  "technical_interview",
  "onsite",
  "offer",
]);

const INTERVIEW_STAGES = new Set([
  "hiring_manager_screen",
  "technical_interview",
  "onsite",
]);

const FINAL_STAGES = new Set(["onsite", "offer"]);

function reached(events: StageEvent[], stages: Set<string>) {
  return events.some((event) => stages.has(event.toStage));
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function percent(value: number) {
  return `${String(Math.round(value * 100))}%`;
}

function confidenceFor(
  sample: number,
  moderateAt: number,
  strongAt: number,
): CareerRecommendationConfidence {
  if (sample >= strongAt) return "strong";
  if (sample >= moderateAt) return "moderate";
  return "emerging";
}

function reasonKey(reason: string) {
  return reason
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function buildCareerLearningInsights(
  applications: CareerLearningApplication[],
): CareerLearningInsight[] {
  const qualified = applications.filter(
    ({ job }) => job.suitabilityScore == null || job.suitabilityScore >= 70,
  );
  const sample = qualified.length;
  const responded = qualified.filter(({ events }) =>
    reached(events, RESPONSE_STAGES),
  );
  const screened = qualified.filter(({ events }) =>
    events.some((event) => event.toStage === "recruiter_screen"),
  );
  const interviewed = qualified.filter(({ events }) =>
    reached(events, INTERVIEW_STAGES),
  );
  const finalStage = qualified.filter(({ events }) =>
    reached(events, FINAL_STAGES),
  );
  const offers = qualified.filter(({ events }) =>
    events.some((event) => event.toStage === "offer"),
  );
  const debriefs = qualified.filter(({ events }) =>
    events.some((event) => Boolean(event.metadata?.interviewDebrief?.trim())),
  );

  const rejectionReasons = new Map<string, number>();
  for (const { events } of qualified) {
    for (const event of events) {
      const reason = event.metadata?.reasonCode?.trim();
      if (
        event.outcome === "rejected" &&
        reason &&
        reason.toLowerCase() !== "unknown"
      ) {
        rejectionReasons.set(reason, (rejectionReasons.get(reason) ?? 0) + 1);
      }
    }
  }

  const insights: CareerLearningInsight[] = [];

  const responseRate = ratio(responded.length, sample);
  if (sample >= 10 && responseRate < 0.15) {
    insights.push({
      key: "market-entry-low-response",
      stage: "market_entry",
      confidence: confidenceFor(sample, 10, 15),
      target: "mixed",
      title: "Too few relevant applications are turning into conversations",
      evidence:
        String(responded.length) +
        " of " +
        String(sample) +
        " qualified applications reached a response stage (" +
        percent(responseRate) +
        ").",
      recommendation:
        "Review targeting and positioning before changing career direction. Compare role families, resume framing and the wording you use on LinkedIn, Indeed and other job-platform profiles. The JobAgent should suggest wording; you keep control of the actual profile edits.",
    });
  }

  const screenToInterview = ratio(interviewed.length, screened.length);
  if (screened.length >= 5 && screenToInterview < 0.4) {
    insights.push({
      key: "screening-low-conversion",
      stage: "screening",
      confidence: confidenceFor(screened.length, 5, 7),
      target: "interview_behavior",
      title: "A repeatable screening-stage blocker may be forming",
      evidence:
        String(interviewed.length) +
        " of " +
        String(screened.length) +
        " recruiter screens advanced to a hiring or technical interview (" +
        percent(screenToInterview) +
        ").",
      recommendation:
        "Review repeated screening questions first: work authorization, compensation, language, travel, availability and the 60-second career story. Do not change the overall strategy from one employer's reaction.",
    });
  }

  const interviewToFinal = ratio(finalStage.length, interviewed.length);
  if (interviewed.length >= 3 && interviewToFinal < 0.34) {
    insights.push({
      key: "interview-low-final-conversion",
      stage: "interview",
      confidence: confidenceFor(interviewed.length, 3, 5),
      target: "interview_behavior",
      title: "Interview performance now has enough evidence to review",
      evidence:
        String(finalStage.length) +
        " of " +
        String(interviewed.length) +
        " interview-stage applications reached a final stage (" +
        percent(interviewToFinal) +
        "). " +
        String(debriefs.length) +
        " application(s) contain an interview debrief.",
      recommendation:
        debriefs.length > 0
          ? "Compare interview debriefs with actual outcomes. Look for repeated questions, weak examples, technical gaps and employer concerns; practice the next answer before changing target roles."
          : "Start capturing a short interview debrief after each conversation. Without what was actually discussed, the system should not guess why the interview failed.",
    });
  }

  if (interviewed.length > debriefs.length) {
    insights.push({
      key: "interview-missing-debrief",
      stage: "interview",
      confidence: "emerging",
      target: "interview_behavior",
      title: "Interview evidence is incomplete",
      evidence:
        String(interviewed.length - debriefs.length) +
        " interview-stage application(s) do not yet have a debrief.",
      recommendation:
        "After each interview, add a short debrief: what they asked, what felt difficult and what signals you noticed. The JobAgent should compare that account with the later outcome instead of guessing.",
    });
  }

  const repeatedReason = [...rejectionReasons.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];
  if (repeatedReason && repeatedReason[1] >= 3) {
    const [reason, count] = repeatedReason;
    const knownReasonTotal = [...rejectionReasons.values()].reduce(
      (sum, value) => sum + value,
      0,
    );
    if (count / knownReasonTotal >= 0.5) {
      insights.push({
        key: `repeated-rejection-${reasonKey(reason) || "known-reason"}`,
        stage: "market_entry",
        confidence: confidenceFor(count, 3, 5),
        target: "mixed",
        title: "A repeated explicit rejection reason is forming",
        evidence:
          reason +
          " appears in " +
          String(count) +
          " of " +
          String(knownReasonTotal) +
          " rejections with a known reason.",
        recommendation:
          "Treat this as stronger evidence than an inferred cause, but still verify whether the same blocker appears across different employers and role families before changing career direction.",
      });
    }
  }

  if (finalStage.length >= 2 && offers.length === 0) {
    insights.push({
      key: "final-stage-no-offer",
      stage: "final",
      confidence: confidenceFor(finalStage.length, 2, 3),
      target: "interview_behavior",
      title: "Final-stage conversion deserves a focused review",
      evidence:
        String(finalStage.length) +
        " qualified applications reached a final stage and none reached an offer.",
      recommendation:
        "Review closing answers, salary alignment, leadership/fit examples and unresolved employer-risk concerns. Keep this separate from top-of-funnel resume changes.",
    });
  }

  return insights;
}
