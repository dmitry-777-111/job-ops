import { runWithRequestContext } from "@infra/request-context";
import { db, schema } from "@server/db";
import { eq } from "drizzle-orm";
import { recoverInterruptedPipelineRun } from "../pipeline/recover-interrupted";

const pipelineRunId = process.argv[2]?.trim();
if (!pipelineRunId) {
  throw new Error("Usage: tsx src/server/scripts/recover-pipeline-run.ts <pipeline-run-id>");
}

const [row] = await db
  .select({
    tenantId: schema.pipelineRuns.tenantId,
    userId: schema.pipelineRuns.userId,
  })
  .from(schema.pipelineRuns)
  .where(eq(schema.pipelineRuns.id, pipelineRunId))
  .limit(1);

if (!row?.userId || !row.tenantId) {
  throw new Error(`Pipeline run ${pipelineRunId} has no recoverable tenant/user scope.`);
}

const result = await runWithRequestContext(
  {
    requestId: `pipeline-recovery-${pipelineRunId}`,
    pipelineRunId,
    tenantId: row.tenantId,
    userId: row.userId,
  },
  () => recoverInterruptedPipelineRun(pipelineRunId),
);

console.log(JSON.stringify(result));
process.exitCode = result.success ? 0 : 1;
