import type {
  ChartRange,
  FxRate,
  HistoricalPrice,
  Price,
  QuoteNewsItem,
  SearchHit,
} from "@/lib/types";

export interface QuotesResult {
  quotes: Price[];
  providerNotice: string;
}

export interface HistoryResult {
  bars: HistoricalPrice[];
  freshness: Price["freshness"];
  provider: Price["provider"];
  sourceLabel: string;
}

export interface NewsResult {
  items: QuoteNewsItem[];
  available: boolean;
}

export interface MarketDataProvider {
  id: Price["provider"];
  getQuotes(symbols: string[]): Promise<QuotesResult>;
  getHistory(symbol: string, range: ChartRange): Promise<HistoryResult>;
  search(query: string): Promise<SearchHit[]>;
  getNews(symbol: string): Promise<NewsResult>;
  getFxRate(): Promise<FxRate>;
}

export interface HistoricalDataProvider {
  getHistory(symbol: string, range: ChartRange): Promise<HistoryResult>;
  getHistoryBetween(
    symbol: string,
    fromIso: string,
    toIso: string,
  ): Promise<HistoryResult>;
}
