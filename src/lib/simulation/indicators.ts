import type { HistoricalPrice } from "@/lib/types";

function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i + 1 < period) return null;
    const slice = values.slice(i + 1 - period, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function ema(values: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const out: (number | null)[] = [];
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period) {
      out.push(null);
      continue;
    }
    if (prev == null) {
      prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      out.push(prev);
    } else {
      prev = values[i] * k + prev * (1 - k);
      out.push(prev);
    }
  }
  return out;
}

export function computeSma(bars: HistoricalPrice[], period: number) {
  const closes = bars.map((b) => b.close);
  const values = sma(closes, period);
  return bars
    .map((b, i) => (values[i] == null ? null : { time: b.time, value: values[i]! }))
    .filter((x): x is { time: number; value: number } => x != null);
}

export function computeEma(bars: HistoricalPrice[], period: number) {
  const closes = bars.map((b) => b.close);
  const values = ema(closes, period);
  return bars
    .map((b, i) => (values[i] == null ? null : { time: b.time, value: values[i]! }))
    .filter((x): x is { time: number; value: number } => x != null);
}

export function computeRsi(bars: HistoricalPrice[], period = 14) {
  const closes = bars.map((b) => b.close);
  const rsi: (number | null)[] = Array(closes.length).fill(null);
  if (closes.length <= period) return [];
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return bars
    .map((b, i) => (rsi[i] == null ? null : { time: b.time, value: rsi[i]! }))
    .filter((x): x is { time: number; value: number } => x != null);
}

export function computeMacd(bars: HistoricalPrice[]) {
  const closes = bars.map((b) => b.close);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = closes.map((_, i) =>
    ema12[i] != null && ema26[i] != null ? ema12[i]! - ema26[i]! : null,
  );
  const macdNums = macdLine.map((v) => v ?? 0);
  const signal = ema(
    macdNums.map((v, i) => (macdLine[i] == null ? NaN : v)).filter((v) => !Number.isNaN(v)),
    9,
  );
  let si = 0;
  const aligned: (number | null)[] = macdLine.map((v) => {
    if (v == null) return null;
    const s = signal[si++];
    return s ?? null;
  });
  return bars
    .map((b, i) => {
      if (macdLine[i] == null || aligned[i] == null) return null;
      return {
        time: b.time,
        macd: macdLine[i]!,
        signal: aligned[i]!,
        hist: macdLine[i]! - aligned[i]!,
      };
    })
    .filter(
      (x): x is { time: number; macd: number; signal: number; hist: number } => x != null,
    );
}
