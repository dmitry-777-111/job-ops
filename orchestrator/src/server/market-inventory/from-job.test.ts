import type { CreateJobInput } from "@shared/types";
import { describe, expect, it } from "vitest";
import {
  inferMarketObservationAuthority,
  marketPostingInputFromJob,
} from "./from-job";

const base: CreateJobInput = {
  source: "indeed",
  title: "Maintenance Supervisor",
  employer: "Acme Foods",
  jobUrl: "https://indeed.example/job/123",
};

describe("market inventory job adapter", () => {
  it("classifies official ATS sources separately from job boards", () => {
    expect(inferMarketObservationAuthority("workday:acme")).toBe("official");
    expect(inferMarketObservationAuthority("greenhouse:beta")).toBe("official");
    expect(inferMarketObservationAuthority("indeed")).toBe("board");
    expect(inferMarketObservationAuthority("jobbank")).toBe("board");
  });

  it("does not treat a board source id as an official requisition id", () => {
    const input = marketPostingInputFromJob({
      ...base,
      sourceJobId: "board-1",
    });
    expect(input.sourceJobId).toBe("board-1");
    expect(input.officialRequisitionId).toBeNull();
  });

  it("maps an ATS source id to an official requisition id", () => {
    const input = marketPostingInputFromJob({
      ...base,
      source: "workday:acme",
      sourceJobId: "REQ-42",
      jobUrlDirect: "https://acme.wd5.myworkdayjobs.com/job/REQ-42",
    });
    expect(input.authority).toBe("official");
    expect(input.officialRequisitionId).toBe("REQ-42");
  });
});
