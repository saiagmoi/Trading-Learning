import type { ChartIntervalSpec, ChartRange } from "@/lib/types";

export function specForRange(range: ChartRange): ChartIntervalSpec {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  switch (range) {
    case "1d":
      return { interval: "5m", period1: new Date(now - 1 * day) };
    case "1w":
      return { interval: "15m", period1: new Date(now - 7 * day) };
    case "1m":
      return { interval: "1d", period1: new Date(now - 31 * day) };
    case "3m":
      return { interval: "1d", period1: new Date(now - 93 * day) };
    case "6m":
      return { interval: "1d", period1: new Date(now - 186 * day) };
    case "1y":
      return { interval: "1d", period1: new Date(now - 366 * day) };
    case "5y":
      return { interval: "1wk", period1: new Date(now - 5 * 366 * day) };
    case "10y":
      return { interval: "1wk", period1: new Date(now - 10 * 366 * day) };
    case "max":
      return { interval: "1mo", period1: new Date("1980-01-01T00:00:00Z") };
  }
}

export const RANGE_LABELS: Record<ChartRange, string> = {
  "1d": "1 día",
  "1w": "1 semana",
  "1m": "1 mes",
  "3m": "3 meses",
  "6m": "6 meses",
  "1y": "1 año",
  "5y": "5 años",
  "10y": "10 años",
  max: "Máximo",
};
