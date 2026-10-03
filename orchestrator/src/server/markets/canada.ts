import type { MarketAdapter } from "./types";

export const canadaMarketAdapter: MarketAdapter = {
  id: "canada",
  label: "Canada",
  countryKeys: ["canada"],
  defaultCurrency: "CAD",
  occupationSystem: {
    id: "noc",
    label: "National Occupational Classification",
  },
  capabilities: {
    workAuthorization: true,
    employerSupportSignals: true,
    salaryNormalization: true,
    occupationMapping: true,
    localizedSearchTerms: true,
  },
};
