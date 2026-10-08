import YahooFinance from "yahoo-finance2";
import {
  assetFromYahooQuote,
  findAsset,
  yahooSymbolFor,
} from "@/lib/assets";
import { cached } from "@/lib/market/cache";
import type {
  HistoricalDataProvider,
  HistoryResult,
  MarketDataProvider,
  NewsResult,
  QuotesResult,
} from "@/lib/market/provider";
import { specForRange } from "@/lib/market/range";
import type { ChartRange, Currency, FxRate, HistoricalPrice, Price, SearchHit } from "@/lib/types";

const yahoo = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

const SOURCE =
  "Yahoo Finance (cotizaciones generalmente retrasadas ~15 minutos; no es un feed de broker).";

function asCurrency(value: string | undefined | null): Currency {
  return value === "ARS" ? "ARS" : "USD";
}

function toUnix(value: unknown): number {
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (typeof value === "number") return value > 2_000_000_000 ? Math.floor(value / 1000) : value;
  if (typeof value === "string") return Math.floor(new Date(value).getTime() / 1000);
  return Math.floor(Date.now() / 1000);
}

function mapQuote(raw: Record<string, unknown>, displaySymbol: string): Price {
  const currency = asCurrency(String(raw.currency ?? "USD"));
  const price = Number(raw.regularMarketPrice ?? raw.postMarketPrice ?? 0);
  const change = Number(raw.regularMarketChange ?? 0);
  const changePercent = Number(raw.regularMarketChangePercent ?? 0);
  const time = raw.regularMarketTime
    ? new Date(raw.regularMarketTime as string | number | Date).toISOString()
    : new Date().toISOString();
  return {
    symbol: displaySymbol,
    price,
    currency,
    change,
    changePercent,
    dayHigh: raw.regularMarketDayHigh != null ? Number(raw.regularMarketDayHigh) : null,
    dayLow: raw.regularMarketDayLow != null ? Number(raw.regularMarketDayLow) : null,
    volume: raw.regularMarketVolume != null ? Number(raw.regularMarketVolume) : null,
    previousClose:
      raw.regularMarketPreviousClose != null
        ? Number(raw.regularMarketPreviousClose)
        : null,
    marketCap: raw.marketCap != null ? Number(raw.marketCap) : null,
    peRatio: raw.trailingPE != null ? Number(raw.trailingPE) : null,
    dividendYield:
      raw.trailingAnnualDividendYield != null
        ? Number(raw.trailingAnnualDividendYield) * 100
        : raw.dividendYield != null
          ? Number(raw.dividendYield)
          : null,
    freshness: "delayed",
    provider: "yahoo",
    lastUpdated: time,
    sourceLabel: SOURCE,
  };
}

function mapBars(quotes: Array<Record<string, unknown>>): HistoricalPrice[] {
  return quotes
    .filter((q) => q.close != null && q.open != null)
    .map((q) => ({
      time: toUnix(q.date ?? q.timestamp),
      open: Number(q.open),
      high: Number(q.high ?? q.close),
      low: Number(q.low ?? q.close),
      close: Number(q.close),
      volume: q.volume != null ? Number(q.volume) : null,
    }))
    .filter((b) => Number.isFinite(b.close) && b.time > 0)
    .sort((a, b) => a.time - b.time);
}

export class YahooMarketDataProvider implements MarketDataProvider, HistoricalDataProvider {
  id = "yahoo" as const;

  async getQuotes(symbols: string[]): Promise<QuotesResult> {
    const unique = [...new Set(symbols.filter(Boolean))];
    if (unique.length === 0) {
      return { quotes: [], providerNotice: SOURCE };
    }
    const key = `quotes:${unique.map((s) => yahooSymbolFor(s)).sort().join(",")}`;
    return cached(key, 20_000, async () => {
      const yahooSymbols = unique.map(yahooSymbolFor);
      const result = await yahoo.quote(yahooSymbols);
      const list = Array.isArray(result) ? result : [result];
      const quotes: Price[] = [];
      for (let i = 0; i < unique.length; i++) {
        const raw = list.find(
          (q) =>
            String((q as { symbol?: string }).symbol).toUpperCase() ===
            yahooSymbols[i].toUpperCase(),
        ) as Record<string, unknown> | undefined;
        if (!raw) continue;
        const known = findAsset(unique[i]);
        if (!known) {
          assetFromYahooQuote({
            symbol: String(raw.symbol ?? yahooSymbols[i]),
            shortName: raw.shortName as string | undefined,
            longName: raw.longName as string | undefined,
            quoteType: raw.quoteType as string | undefined,
            currency: raw.currency as string | undefined,
            exchange: raw.fullExchangeName as string | undefined,
          });
        }
        quotes.push(mapQuote(raw, unique[i]));
      }
      return { quotes, providerNotice: SOURCE };
    });
  }

  async getHistory(symbol: string, range: ChartRange): Promise<HistoryResult> {
    const spec = specForRange(range);
    const ys = yahooSymbolFor(symbol);
    return cached(`hist:${ys}:${range}`, 120_000, async () => {
      const chart = await yahoo.chart(ys, {
        period1: spec.period1,
        interval: spec.interval,
      });
      const bars = mapBars((chart.quotes ?? []) as Array<Record<string, unknown>>);
      return {
        bars,
        freshness: "historical",
        provider: "yahoo",
        sourceLabel: SOURCE,
      };
    });
  }

  async getHistoryBetween(symbol: string, fromIso: string, toIso: string): Promise<HistoryResult> {
    const ys = yahooSymbolFor(symbol);
    const from = new Date(fromIso);
    const to = new Date(toIso);
    const spanYears = (to.getTime() - from.getTime()) / (365 * 24 * 3600 * 1000);
    const interval = spanYears > 8 ? "1wk" : "1d";
    return cached(`histb:${ys}:${fromIso}:${toIso}:${interval}`, 180_000, async () => {
      const chart = await yahoo.chart(ys, {
        period1: from,
        period2: to,
        interval: interval as "1d" | "1wk",
      });
      return {
        bars: mapBars((chart.quotes ?? []) as Array<Record<string, unknown>>),
        freshness: "historical",
        provider: "yahoo",
        sourceLabel: SOURCE,
      };
    });
  }

  async search(query: string): Promise<SearchHit[]> {
    const q = query.trim();
    if (q.length < 1) return [];
    return cached(`search:${q.toLowerCase()}`, 60_000, async () => {
      const res = await yahoo.search(q, { newsCount: 0, quotesCount: 12 });
      const hits: SearchHit[] = [];
      for (const item of res.quotes ?? []) {
        const rec = item as {
          symbol?: string;
          shortname?: string;
          longname?: string;
          quoteType?: string;
          exchDisp?: string;
        };
        if (!rec.symbol) continue;
        const asset = assetFromYahooQuote({
          symbol: rec.symbol,
          shortName: rec.shortname,
          longName: rec.longname,
          quoteType: rec.quoteType,
          exchange: rec.exchDisp,
        });
        hits.push({ asset, score: 1 });
      }
      return hits;
    });
  }

  async getNews(symbol: string): Promise<NewsResult> {
    const ys = yahooSymbolFor(symbol);
    return cached(`news:${ys}`, 300_000, async () => {
      try {
        const res = await yahoo.search(ys, { newsCount: 8, quotesCount: 0 });
        const items = (res.news ?? []).map((n) => ({
          title: n.title,
          publisher: n.publisher ?? "Yahoo Finance",
          publishedAt: n.providerPublishTime
            ? new Date(Number(n.providerPublishTime) * 1000).toISOString()
            : new Date().toISOString(),
          url: n.link,
        }));
        return { items, available: items.length > 0 };
      } catch {
        return { items: [], available: false };
      }
    });
  }

  async getFxRate(): Promise<FxRate> {
    return cached("fx:USDARS", 60_000, async () => {
      const q = (await yahoo.quote("ARS=X")) as Record<string, unknown>;
      const rate = Number(q.regularMarketPrice ?? 0);
      if (!rate) throw new Error("No se pudo obtener el tipo de cambio USD/ARS.");
      const time = q.regularMarketTime
        ? new Date(q.regularMarketTime as string | number | Date).toISOString()
        : new Date().toISOString();
      return {
        pair: "USDARS",
        rate,
        freshness: "delayed",
        provider: "yahoo",
        lastUpdated: time,
        sourceLabel: "Yahoo Finance · par ARS=X (USD/ARS, retrasado).",
      };
    });
  }
}

export const yahooProvider = new YahooMarketDataProvider();
export class RealMarketDataProvider extends YahooMarketDataProvider {}
export const realMarketDataProvider = new RealMarketDataProvider();
