import type { HistoricalDataProvider, MarketDataProvider } from "@/lib/market/provider";
import { demoProvider } from "@/lib/market/providers/demo";
import { yahooProvider } from "@/lib/market/providers/yahoo";

/**
 * Punto único para cambiar de proveedor.
 * MARKET_DATA_PROVIDER=yahoo|demo
 * Para un proveedor nuevo: implementá MarketDataProvider y agregalo al switch.
 */
export function getMarketDataProvider(): MarketDataProvider & HistoricalDataProvider {
  const id = (process.env.MARKET_DATA_PROVIDER ?? "yahoo").toLowerCase();
  if (id === "demo") return demoProvider;
  return yahooProvider;
}

export function isLiveTradingEnabled(): boolean {
  return process.env.LIVE_TRADING_ENABLED === "true";
}
