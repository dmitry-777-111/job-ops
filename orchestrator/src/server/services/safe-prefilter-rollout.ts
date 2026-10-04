export const SAFE_PREFILTER_ROLLOUT_MODES = [
  "shadow",
  "audit",
  "active",
] as const;
export type SafePrefilterRolloutMode =
  (typeof SAFE_PREFILTER_ROLLOUT_MODES)[number];

export type SafePrefilterGateMetrics = {
  totalEvaluated: number;
  safeRejects: number;
  knownDecisionWorthyFalseRejects: number;
  auditedRejects: number;
  auditedFalseRejects: number;
};

export type SafePrefilterGateAssessment = {
  passed: boolean;
  reasons: string[];
  estimatedSavingsRate: number;
  auditCoverageRate: number;
};

export function assessSafePrefilterGate(
  metrics: SafePrefilterGateMetrics,
): SafePrefilterGateAssessment {
  const reasons: string[] = [];
  const estimatedSavingsRate =
    metrics.totalEvaluated > 0
      ? metrics.safeRejects / metrics.totalEvaluated
      : 0;
  const auditCoverageRate =
    metrics.safeRejects > 0 ? metrics.auditedRejects / metrics.safeRejects : 0;

  if (metrics.totalEvaluated <= 0) reasons.push("no_shadow_inventory");
  if (metrics.safeRejects <= 0) reasons.push("no_measurable_savings");
  if (metrics.knownDecisionWorthyFalseRejects > 0) {
    reasons.push("known_decision_worthy_false_reject");
  }
  if (metrics.auditedRejects < metrics.safeRejects) {
    reasons.push("safe_reject_set_not_fully_audited");
  }
  if (metrics.auditedFalseRejects > 0) reasons.push("audit_false_reject");

  return {
    passed: reasons.length === 0,
    reasons,
    estimatedSavingsRate,
    auditCoverageRate,
  };
}

export function resolveSafePrefilterRollout(input: {
  requestedMode: SafePrefilterRolloutMode;
  metrics: SafePrefilterGateMetrics;
  explicitActivationApproved?: boolean;
}): {
  effectiveMode: "shadow" | "audit" | "active";
  enforceSafeReject: boolean;
  gate: SafePrefilterGateAssessment;
  blockedReason: string | null;
} {
  const gate = assessSafePrefilterGate(input.metrics);

  if (input.requestedMode === "shadow") {
    return {
      effectiveMode: "shadow",
      enforceSafeReject: false,
      gate,
      blockedReason: null,
    };
  }

  if (input.requestedMode === "audit") {
    return {
      effectiveMode: "audit",
      enforceSafeReject: false,
      gate,
      blockedReason: null,
    };
  }

  if (!gate.passed) {
    return {
      effectiveMode: "audit",
      enforceSafeReject: false,
      gate,
      blockedReason: "prefilter_gate_not_passed",
    };
  }

  if (input.explicitActivationApproved !== true) {
    return {
      effectiveMode: "audit",
      enforceSafeReject: false,
      gate,
      blockedReason: "explicit_activation_approval_required",
    };
  }

  return {
    effectiveMode: "active",
    enforceSafeReject: true,
    gate,
    blockedReason: null,
  };
}
