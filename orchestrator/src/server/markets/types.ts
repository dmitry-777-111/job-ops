export interface MarketOccupationSystem {
  id: string;
  label: string;
  version?: string | null;
}

export interface MarketAdapterCapabilities {
  workAuthorization: boolean;
  employerSupportSignals: boolean;
  salaryNormalization: boolean;
  occupationMapping: boolean;
  localizedSearchTerms: boolean;
}

/**
 * Country/market boundary for CAREER OS. Core pipeline code should depend on
 * this contract rather than on Canada-specific concepts such as NOC or LMIA.
 */
export interface MarketAdapter {
  id: string;
  label: string;
  countryKeys: readonly string[];
  defaultCurrency: string;
  occupationSystem?: MarketOccupationSystem | null;
  capabilities: MarketAdapterCapabilities;
}
