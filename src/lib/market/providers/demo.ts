import { findAsset, getAllKnownAssets, yahooSymbolFor } from "@/lib/assets";
import type {
  HistoricalDataProvider,
  HistoryResult,
  MarketDataProvider,
  NewsResult,
  QuotesResult,
} from "@/lib/market/provider";
import { specForRange } from "@/lib/market/range";
import type { ChartRange, FxRate, HistoricalPrice, Price, SearchHit } from "@/lib/types";

const SOURCE =
  "DATOS DE DEMOSTRACIÓN. No son precios de mercado. Solo para desarrollo cuando no hay API.";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function basePrice(symbol: string): number {
  const n = hash(symbol) % 400;
  if (symbol.includes("MERV") || symbol.endsWith(".BA")) return 800 + (n % 4000);
  if (["SPY", "QQQ", "DIA", "IWM"].includes(symbol)) return 200 + (n % 300);
  return 40 + (n % 400);
}

function series(symbol: string, from: Date, intervalSec: number): HistoricalPrice[] {
  const rng = mulberry32(hash(symbol));
  const start = Math.floor(from.getTime() / 1000);
  const end = Math.floor(Date.now() / 1000);
  const bars: HistoricalPrice[] = [];
  let price = basePrice(symbol);
  for (let t = start; t <= end; t += intervalSec) {
    const drift = (rng() - 0.48) * 0.012 * price;
    const open = price;
    const close = Math.max(0.5, price + drift);
    const high = Math.max(open, close) * (1 + rng() * 0.006);
    const low = Math.min(open, close) * (1 - rng() * 0.006);
    bars.push({
      time: t,
      open,
      high,
      low,
      close,
      volume: Math.floor(200_000 + rng() * 5_000_000),
    });
    price = close;
  }
  return bars.slice(-800);
}

function intervalSeconds(range: ChartRange): number {
  const spec = specForRange(range);
  switch (spec.interval) {
    case "5m":
      return 300;
    case "15m":
      return 900;
    case "1h":
      return 3600;
    case "1d":
      return 86400;
    case "1wk":
      return 86400 * 7;
    case "1mo":
      return 86400 * 30;
  }
}

function lastQuote(symbol: string): Price {
  const asset = findAsset(symbol);
  const bars = series(yahooSymbolFor(symbol), specForRange("1m").period1, 86400);
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2] ?? last;
  const change = last.close - prev.close;
  return {
    symbol,
    price: last.close,
    currency: asset?.currency ?? "USD",
    change,
    changePercent: (change / prev.close) * 100,
    dayHigh: last.high,
    dayLow: last.low,
    volume: last.volume,
    previousClose: prev.close,
    marketCap: null,
    peRatio: null,
    dividendYield: null,
    freshness: "demo",
    provider: "demo",
    lastUpdated: new Date().toISOString(),
    sourceLabel: SOURCE,
  };
}

export class DemoMarketDataProvider implements MarketDataProvider, HistoricalDataProvider {
  id = "demo" as const;

  async getQuotes(symbols: string[]): Promise<QuotesResult> {
    return {
      quotes: [...new Set(symbols)].map(lastQuote),
      providerNotice: SOURCE,
    };
  }

  async getHistory(symbol: string, range: ChartRange): Promise<HistoryResult> {
    const spec = specForRange(range);
    return {
      bars: series(yahooSymbolFor(symbol), spec.period1, intervalSeconds(range)),
      freshness: "demo",
      provider: "demo",
      sourceLabel: SOURCE,
    };
  }

  async getHistoryBetween(symbol: string, fromIso: string, toIso: string): Promise<HistoryResult> {
    const from = new Date(fromIso);
    const bars = series(yahooSymbolFor(symbol), from, 86400).filter(
      (b) => b.time * 1000 <= new Date(toIso).getTime(),
    );
    return {
      bars,
      freshness: "demo",
      provider: "demo",
      sourceLabel: SOURCE,
    };
  }

  async search(query: string): Promise<SearchHit[]> {
    const q = query.toLowerCase();
    return getAllKnownAssets()
      .filter(
        (a) =>
          a.symbol.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q),
      )
      .map((asset) => ({ asset, score: 1 }));
  }

  async getNews(): Promise<NewsResult> {
    return { items: [], available: false };
  }

  async getFxRate(): Promise<FxRate> {
    return {
      pair: "USDARS",
      rate: 1200,
      freshness: "demo",
      provider: "demo",
      lastUpdated: new Date().toISOString(),
      sourceLabel: SOURCE,
    };
  }
}

export const demoProvider = new DemoMarketDataProvider();
