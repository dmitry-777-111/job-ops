import { describe, expect, it } from "vitest";
import {
  CANADA_HARD_REQUIREMENT_SIGNALS,
  extractCanadaHardRequirementSignals,
} from "./canada-hard-requirements";

const S = CANADA_HARD_REQUIREMENT_SIGNALS;

describe("Canada hard requirement evidence", () => {
  it.each([
    [
      "The applicant must be a Canadian Citizen with 10 years verifiable history on Canadian soil.",
      S.CITIZENSHIP_REQUIRED,
    ],
    [
      "Must be a Canadian citizen and hold a valid Secret security clearance.",
      S.CITIZENSHIP_REQUIRED,
    ],
    [
      "Client requirements for this position require Canadian Citizenship or Permanent Resident Status.",
      S.CITIZEN_OR_PR_ONLY,
    ],
    [
      "Must obtain and maintain Reliability Clearance (Canadian Citizen or Permanent Resident of 5 years).",
      S.CITIZEN_OR_PR_ONLY,
    ],
    [
      "Must hold or be eligible to obtain a Canadian passport and be available for occasional U.S. travel.",
      S.CANADIAN_PASSPORT_REQUIRED,
    ],
    [
      "Valid Canadian Passport (or eligibility to obtain one) for occasional cross-border training.",
      S.CANADIAN_PASSPORT_REQUIRED,
    ],
  ])("extracts strong mandatory evidence: %s", (description, signal) => {
    expect(extractCanadaHardRequirementSignals(description)).toContain(signal);
  });

  it.each([
    "Preference will be given to Canadian citizens and permanent residents of Canada.",
    "Legally allowed to work in Canada: Canadian citizen, permanent resident, or existing VISA with no work restrictions.",
    "Proof of eligibility may be a Canadian passport, citizenship certificate, permanent residence, or open work permit.",
    "Canadian citizens and permanent residents will be given priority, but all qualified applicants are encouraged to apply.",
    "In accordance with Canadian immigration requirements, Canadian citizens and permanent residents will be given priority.",
    "Applicants must be authorized to work in Canada to apply (Canadian Citizen or Permanent Resident).",
  ])("does not turn preference or alternative eligibility into a hard signal: %s", (description) => {
    expect(extractCanadaHardRequirementSignals(description)).toEqual([]);
  });
});
