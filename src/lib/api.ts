import type {
  ChartRange,
  FxRate,
  HistoricalPrice,
  Price,
  QuoteNewsItem,
  SearchHit,
} from "@/lib/types";

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Error de red");
  }
  return data as T;
}

export function fetchQuotes(symbols: string[]) {
  const q = encodeURIComponent(symbols.join(","));
  return json<{
    quotes: Price[];
    providerNotice: string;
    provider: string;
    demo: boolean;
  }>(`/api/market/quotes?symbols=${q}`);
}

export function fetchHistory(symbol: string, range: ChartRange) {
  return json<{
    bars: HistoricalPrice[];
    freshness: string;
    provider: string;
    sourceLabel: string;
    demo: boolean;
  }>(`/api/market/history?symbol=${encodeURIComponent(symbol)}&range=${range}`);
}

export function fetchHistoryBetween(symbol: string, from: string, to: string) {
  return json<{
    bars: HistoricalPrice[];
    sourceLabel: string;
    demo: boolean;
  }>(
    `/api/market/history-range?symbol=${encodeURIComponent(symbol)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
}

export function fetchSearch(q: string) {
  return json<{ hits: SearchHit[]; demo: boolean }>(
    `/api/market/search?q=${encodeURIComponent(q)}`,
  );
}

export function fetchNews(symbol: string) {
  return json<{ items: QuoteNewsItem[]; available: boolean }>(
    `/api/market/news?symbol=${encodeURIComponent(symbol)}`,
  );
}

export function fetchFx() {
  return json<{ fx: FxRate; demo: boolean }>("/api/market/fx");
}

export function fetchStatus() {
  return json<{
    us: { isOpen: boolean; label: string; nextHint: string };
    ar: { isOpen: boolean; label: string; nextHint: string };
    provider: string;
    liveTrading: boolean;
  }>("/api/market/status");
}
