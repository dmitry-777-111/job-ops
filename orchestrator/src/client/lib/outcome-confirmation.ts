import type {
  ApplicationStage,
  JobListItem,
  StageEvent,
} from "@shared/types.js";

const INTERVIEW_STAGES = new Set<ApplicationStage>([
  "recruiter_screen",
  "hiring_manager_screen",
  "technical_interview",
  "onsite",
]);

const TIMEOUT_SECONDS: Partial<Record<ApplicationStage, number>> = {
  recruiter_screen: 7 * 24 * 60 * 60,
  hiring_manager_screen: 7 * 24 * 60 * 60,
  technical_interview: 5 * 24 * 60 * 60,
  onsite: 5 * 24 * 60 * 60,
};

const NEXT_STAGE: Partial<Record<ApplicationStage, ApplicationStage>> = {
  recruiter_screen: "hiring_manager_screen",
  hiring_manager_screen: "technical_interview",
  technical_interview: "onsite",
  onsite: "offer",
};

export type PendingOutcomeConfirmation = {
  job: JobListItem;
  interviewEvent: StageEvent;
  nextStage: ApplicationStage;
  dueAt: number;
  lastCheckedAt: number | null;
};

function isWaitingCheck(event: StageEvent) {
  return event.metadata?.outcomeCheck === "waiting";
}

function hasResolvedOutcomeAfter(events: StageEvent[], event: StageEvent) {
  return events.some(
    (candidate) =>
      candidate.id !== event.id &&
      candidate.occurredAt >= event.occurredAt &&
      !isWaitingCheck(candidate) &&
      (candidate.outcome != null || candidate.toStage !== event.toStage),
  );
}

export function getPendingOutcomeConfirmation(
  job: JobListItem,
  events: StageEvent[],
  now = Math.floor(Date.now() / 1000),
): PendingOutcomeConfirmation | null {
  if (job.outcome) return null;

  const interviews = events
    .filter(
      (event) =>
        INTERVIEW_STAGES.has(event.toStage) &&
        !isWaitingCheck(event) &&
        event.metadata?.eventType !== "note",
    )
    .sort((a, b) => b.occurredAt - a.occurredAt);
  const interviewEvent = interviews[0];
  if (!interviewEvent) return null;
  if (
    interviewEvent.outcome ||
    hasResolvedOutcomeAfter(events, interviewEvent)
  ) {
    return null;
  }

  const timeout = TIMEOUT_SECONDS[interviewEvent.toStage];
  const nextStage = NEXT_STAGE[interviewEvent.toStage];
  if (!timeout || !nextStage) return null;

  const lastWaiting = events
    .filter(
      (event) =>
        event.occurredAt > interviewEvent.occurredAt && isWaitingCheck(event),
    )
    .sort((a, b) => b.occurredAt - a.occurredAt)[0];
  const baseline = lastWaiting?.occurredAt ?? interviewEvent.occurredAt;
  const dueAt = baseline + timeout;
  if (now < dueAt) return null;

  return {
    job,
    interviewEvent,
    nextStage,
    dueAt,
    lastCheckedAt: lastWaiting?.occurredAt ?? null,
  };
}

export function isResolvedAfterStage(
  job: JobListItem,
  events: StageEvent[],
  stages: ReadonlySet<string>,
) {
  if (job.outcome) return true;
  const stageEvents = events
    .filter((event) => stages.has(event.toStage))
    .sort((a, b) => b.occurredAt - a.occurredAt);
  const latest = stageEvents[0];
  if (!latest) return false;
  if (latest.outcome) return true;
  return hasResolvedOutcomeAfter(events, latest);
}
