import { describe, expect, it } from "vitest";
import {
  assessSafePrefilterGate,
  resolveSafePrefilterRollout,
} from "./safe-prefilter-rollout";

const greenMetrics = {
  totalEvaluated: 1274,
  safeRejects: 10,
  knownDecisionWorthyFalseRejects: 0,
  auditedRejects: 10,
  auditedFalseRejects: 0,
};

describe("safe prefilter staged rollout", () => {
  it("keeps shadow and audit modes non-enforcing", () => {
    expect(
      resolveSafePrefilterRollout({
        requestedMode: "shadow",
        metrics: greenMetrics,
      }).enforceSafeReject,
    ).toBe(false);
    expect(
      resolveSafePrefilterRollout({
        requestedMode: "audit",
        metrics: greenMetrics,
      }).enforceSafeReject,
    ).toBe(false);
  });

  it("blocks active mode when any known decision-worthy false reject exists", () => {
    const result = resolveSafePrefilterRollout({
      requestedMode: "active",
      metrics: {
        ...greenMetrics,
        knownDecisionWorthyFalseRejects: 1,
      },
      explicitActivationApproved: true,
    });

    expect(result.effectiveMode).toBe("audit");
    expect(result.enforceSafeReject).toBe(false);
    expect(result.gate.reasons).toContain("known_decision_worthy_false_reject");
  });

  it("requires the entire current safe-reject set to be audited", () => {
    const gate = assessSafePrefilterGate({
      ...greenMetrics,
      auditedRejects: 9,
    });
    expect(gate.passed).toBe(false);
    expect(gate.reasons).toContain("safe_reject_set_not_fully_audited");
  });

  it("requires measurable savings before activation", () => {
    const gate = assessSafePrefilterGate({
      ...greenMetrics,
      safeRejects: 0,
      auditedRejects: 0,
    });
    expect(gate.passed).toBe(false);
    expect(gate.reasons).toContain("no_measurable_savings");
  });

  it("still requires explicit activation approval after all data gates pass", () => {
    const withoutApproval = resolveSafePrefilterRollout({
      requestedMode: "active",
      metrics: greenMetrics,
    });
    const withApproval = resolveSafePrefilterRollout({
      requestedMode: "active",
      metrics: greenMetrics,
      explicitActivationApproved: true,
    });

    expect(withoutApproval.enforceSafeReject).toBe(false);
    expect(withoutApproval.blockedReason).toBe(
      "explicit_activation_approval_required",
    );
    expect(withApproval.enforceSafeReject).toBe(true);
    expect(withApproval.effectiveMode).toBe("active");
  });
});
