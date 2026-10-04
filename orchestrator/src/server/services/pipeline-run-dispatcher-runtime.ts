import { logger } from "@infra/logger";
import { sanitizeUnknown } from "@infra/sanitize";
import { dispatchReadyCandidateRunRequests } from "./pipeline-run-dispatcher";

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 10_000;

let timer: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;

function parseIntervalMs(raw: string | undefined): number {
  if (!raw) return DEFAULT_INTERVAL_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, Math.floor(parsed));
}

export function isPipelineRunDispatcherRunning(): boolean {
  return timer !== null;
}

export async function runPipelineDispatcherTick(): Promise<{
  skipped: boolean;
  dispatched: number;
}> {
  if (tickInFlight) return { skipped: true, dispatched: 0 };
  tickInFlight = true;
  try {
    const results = await dispatchReadyCandidateRunRequests(5);
    if (results.length > 0) {
      logger.info("Pipeline dispatcher tick completed", {
        dispatched: results.length,
        outcomes: results.map((item) => item.result.status),
      });
    }
    return { skipped: false, dispatched: results.length };
  } catch (error) {
    logger.error("Pipeline dispatcher tick failed", {
      error: sanitizeUnknown(error),
    });
    return { skipped: false, dispatched: 0 };
  } finally {
    tickInFlight = false;
  }
}

export function startPipelineRunDispatcher(options?: {
  intervalMs?: number;
}): void {
  if (timer) return;
  const intervalMs = Math.max(
    MIN_INTERVAL_MS,
    Math.floor(
      options?.intervalMs ??
        parseIntervalMs(process.env.CAREER_OS_PIPELINE_DISPATCH_INTERVAL_MS),
    ),
  );

  timer = setInterval(() => {
    void runPipelineDispatcherTick();
  }, intervalMs);
  timer.unref?.();

  logger.info("Pipeline run dispatcher started", { intervalMs });
}

export function stopPipelineRunDispatcher(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  logger.info("Pipeline run dispatcher stopped");
}
