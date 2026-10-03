import { canadaMarketAdapter } from "./canada";
import type { MarketAdapter } from "./types";

const adapters = new Map<string, MarketAdapter>([
  [canadaMarketAdapter.id, canadaMarketAdapter],
]);

export function getMarketAdapter(id: string): MarketAdapter | null {
  return adapters.get(id.trim().toLowerCase()) ?? null;
}

export function listMarketAdapters(): MarketAdapter[] {
  return [...adapters.values()];
}
