import { findAsset } from "@/lib/assets";
import type { HistoricalPrice, Portfolio, Price } from "@/lib/types";

export function findBarOnOrAfter(bars: HistoricalPrice[], isoDate: string): HistoricalPrice | null {
  const t = Math.floor(new Date(isoDate).getTime() / 1000);
  const found = bars.find((b) => b.time >= t);
  return found ?? bars[0] ?? null;
}

export function whatIfSummary(args: {
  invested: number;
  startBar: HistoricalPrice;
  lastBar: HistoricalPrice;
  startDate: string;
}) {
  const shares = args.invested / args.startBar.close;
  const currentValue = shares * args.lastBar.close;
  const gain = currentValue - args.invested;
  const ret = (gain / args.invested) * 100;
  return {
    startPrice: args.startBar.close,
    lastPrice: args.lastBar.close,
    shares,
    currentValue,
    gain,
    returnPercent: ret,
    startDate: args.startDate,
  };
}

export function dcaSummary(args: {
  monthly: number;
  bars: HistoricalPrice[];
  startIso: string;
  endIso: string;
}) {
  const start = new Date(args.startIso);
  const end = new Date(args.endIso);
  let contributed = 0;
  let shares = 0;
  const points: { time: number; value: number; contributed: number }[] = [];
  const cursor = new Date(start);
  cursor.setDate(1);

  const byMonth = new Map<string, HistoricalPrice>();
  for (const bar of args.bars) {
    const d = new Date(bar.time * 1000);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    if (!byMonth.has(key)) byMonth.set(key, bar);
  }

  while (cursor <= end) {
    const key = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}`;
    const bar = byMonth.get(key);
    if (bar && bar.time * 1000 >= start.getTime()) {
      contributed += args.monthly;
      shares += args.monthly / bar.close;
      points.push({
        time: bar.time,
        value: shares * bar.close,
        contributed,
      });
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const last = args.bars[args.bars.length - 1];
  const currentValue = last ? shares * last.close : 0;
  const gain = currentValue - contributed;
  return {
    contributed,
    shares,
    currentValue,
    gain,
    returnPercent: contributed ? (gain / contributed) * 100 : 0,
    points,
  };
}

export function positionMetrics(portfolio: Portfolio, quotes: Price[]) {
  return portfolio.positions.map((p) => {
    const q = quotes.find((x) => x.symbol === p.symbol);
    const asset = findAsset(p.symbol);
    const price = q?.price ?? p.averagePrice;
    const value = price * p.quantity;
    const cost = p.averagePrice * p.quantity;
    const pnl = value - cost;
    const pnlPct = cost ? (pnl / cost) * 100 : 0;
    const dayPnl = q ? (q.change * p.quantity) : 0;
    return {
      ...p,
      name: asset?.name ?? p.symbol,
      price,
      value,
      pnl,
      pnlPct,
      dayPnl,
      currency: p.currency,
    };
  });
}
