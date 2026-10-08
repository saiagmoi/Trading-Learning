"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { fetchHistory } from "@/lib/api";
import { formatDateTime, formatNumber, formatPercent, formatVolume } from "@/lib/format";
import { RANGE_LABELS } from "@/lib/market/range";
import {
  computeEma,
  computeMacd,
  computeRsi,
  computeSma,
} from "@/lib/simulation/indicators";
import type { ChartRange, HistoricalPrice } from "@/lib/types";

const RANGES: ChartRange[] = ["1d", "1w", "1m", "3m", "6m", "1y", "5y", "10y", "max"];

export function PriceChart({ symbol }: { symbol: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<ChartRange>("1y");
  const [style, setStyle] = useState<"candles" | "line">("candles");
  const [bars, setBars] = useState<HistoricalPrice[]>([]);
  const [hover, setHover] = useState<HistoricalPrice | null>(null);
  const [demo, setDemo] = useState(false);
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sma20, setSma20] = useState(false);
  const [sma50, setSma50] = useState(false);
  const [sma200, setSma200] = useState(false);
  const [emaOn, setEmaOn] = useState(false);
  const [rsiOn, setRsiOn] = useState(false);
  const [macdOn, setMacdOn] = useState(false);

  useEffect(() => {
    let live = true;
    fetchHistory(symbol, range)
      .then((r) => {
        if (!live) return;
        setError(null);
        setBars(r.bars);
        setDemo(r.demo);
        setSource(r.sourceLabel);
        setHover(r.bars[r.bars.length - 1] ?? null);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : "Sin histórico");
      });
    return () => {
      live = false;
    };
  }, [symbol, range]);

  useEffect(() => {
    if (!wrap.current) return;
    const chart = createChart(wrap.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#10131c" },
        textColor: "#8b95a8",
        fontFamily: "var(--font-geist-sans)",
      },
      grid: {
        vertLines: { color: "#1c2333" },
        horzLines: { color: "#1c2333" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#232a3b" },
      timeScale: { borderColor: "#232a3b", timeVisible: range === "1d" || range === "1w" },
      autoSize: true,
    });
    chartRef.current = chart;
    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    let priceSeries: ISeriesApi<"Candlestick"> | ISeriesApi<"Line">;
    if (style === "candles") {
      priceSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#3dd68c",
        downColor: "#f07178",
        borderVisible: false,
        wickUpColor: "#3dd68c",
        wickDownColor: "#f07178",
      });
      priceSeries.setData(
        bars.map((b) => ({
          time: b.time as Time,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        })),
      );
    } else {
      priceSeries = chart.addSeries(LineSeries, { color: "#4c8dff", lineWidth: 2 });
      priceSeries.setData(bars.map((b) => ({ time: b.time as Time, value: b.close })));
    }
    vol.setData(
      bars.map((b) => ({
        time: b.time as Time,
        value: b.volume ?? 0,
        color: b.close >= b.open ? "rgba(61,214,140,0.4)" : "rgba(240,113,120,0.4)",
      })),
    );

    const overlays: ISeriesApi<"Line">[] = [];
    const addLine = (data: { time: number; value: number }[], color: string) => {
      const s = chart.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false });
      s.setData(data.map((d) => ({ time: d.time as Time, value: d.value })));
      overlays.push(s);
    };
    if (sma20) addLine(computeSma(bars, 20), "#e8c547");
    if (sma50) addLine(computeSma(bars, 50), "#4c8dff");
    if (sma200) addLine(computeSma(bars, 200), "#c084fc");
    if (emaOn) addLine(computeEma(bars, 20), "#fb923c");

    if (rsiOn) {
      const rsi = chart.addSeries(LineSeries, { color: "#67e8f9", priceScaleId: "rsi", lineWidth: 1 });
      chart.priceScale("rsi").applyOptions({ scaleMargins: { top: 0.72, bottom: 0.08 } });
      rsi.setData(computeRsi(bars).map((d) => ({ time: d.time as Time, value: d.value })));
      overlays.push(rsi);
    }
    if (macdOn) {
      const macd = computeMacd(bars);
      const m = chart.addSeries(LineSeries, { color: "#93c5fd", priceScaleId: "macd", lineWidth: 1 });
      const sig = chart.addSeries(LineSeries, { color: "#f9a8d4", priceScaleId: "macd", lineWidth: 1 });
      chart.priceScale("macd").applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
      m.setData(macd.map((d) => ({ time: d.time as Time, value: d.macd })));
      sig.setData(macd.map((d) => ({ time: d.time as Time, value: d.signal })));
      overlays.push(m, sig);
    }

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) return;
      const t = Number(param.time);
      const bar = bars.find((b) => b.time === t);
      if (bar) setHover(bar);
    });
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, style, sma20, sma50, sma200, emaOn, rsiOn, macdOn, range]);

  const first = bars[0];
  const last = bars[bars.length - 1];
  const change =
    hover && first ? hover.close - first.close : last && first ? last.close - first.close : 0;
  const pct = first ? (change / first.close) * 100 : 0;

  return (
    <div className="card p-3">
      <div className="mb-2 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-lg px-2 py-1 text-xs ${range === r ? "bg-bg text-ink" : "text-muted"}`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
        <button
          className="ml-auto rounded-lg border border-line px-2 py-1 text-xs"
          onClick={() => setStyle((s) => (s === "candles" ? "line" : "candles"))}
        >
          {style === "candles" ? "Velas" : "Línea"}
        </button>
      </div>
      <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-muted">
        <label><input type="checkbox" checked={sma20} onChange={(e) => setSma20(e.target.checked)} /> SMA 20</label>
        <label><input type="checkbox" checked={sma50} onChange={(e) => setSma50(e.target.checked)} /> SMA 50</label>
        <label><input type="checkbox" checked={sma200} onChange={(e) => setSma200(e.target.checked)} /> SMA 200</label>
        <label><input type="checkbox" checked={emaOn} onChange={(e) => setEmaOn(e.target.checked)} /> EMA 20</label>
        <label><input type="checkbox" checked={rsiOn} onChange={(e) => setRsiOn(e.target.checked)} /> RSI</label>
        <label><input type="checkbox" checked={macdOn} onChange={(e) => setMacdOn(e.target.checked)} /> MACD</label>
      </div>
      {demo && (
        <p className="mb-2 rounded-lg bg-demo/15 px-2 py-1 text-xs text-demo">DATOS DE DEMOSTRACIÓN</p>
      )}
      {hover && (
        <div className="mb-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div>Fecha <span className="num text-ink">{formatDateTime(hover.time * 1000)}</span></div>
          <div>Precio <span className="num text-ink">{formatNumber(hover.close)}</span></div>
          <div>Variación <span className={`num ${pct >= 0 ? "text-gain" : "text-loss"}`}>{formatPercent(pct)}</span></div>
          <div>Volumen <span className="num text-ink">{formatVolume(hover.volume)}</span></div>
        </div>
      )}
      {error && <p className="text-sm text-loss">{error}</p>}
      <div ref={wrap} className="h-[380px] w-full" />
      <p className="mt-2 text-[11px] text-muted">{source}</p>
    </div>
  );
}
