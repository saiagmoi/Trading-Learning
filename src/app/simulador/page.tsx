"use client";

import { useState } from "react";
import { fetchHistoryBetween } from "@/lib/api";
import { BENCHMARKS, findAsset, getCatalogAssets, getIndices } from "@/lib/assets";
import { formatMoney, formatPercent, signedMoney } from "@/lib/format";
import { findBarOnOrAfter, whatIfSummary } from "@/lib/simulation/analytics";
import { useSimulation } from "@/store/simulation-store";

export default function SimulatorPage() {
  const assets = [...getCatalogAssets(), ...getIndices()];
  const [symbol, setSymbol] = useState("NVDA");
  const [date, setDate] = useState("2020-01-01");
  const [capital, setCapital] = useState("1000");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof whatIfSummary> | null>(null);
  const [bench, setBench] = useState<
    { name: string; returnPercent: number }[]
  >([]);
  const mark = useSimulation((s) => s.markChallenge);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const invested = Number(capital.replace(",", "."));
      const to = new Date().toISOString();
      const main = await fetchHistoryBetween(symbol, date, to);
      setDemo(main.demo);
      const start = findBarOnOrAfter(main.bars, date);
      const last = main.bars[main.bars.length - 1];
      if (!start || !last) throw new Error("No hay suficientes datos históricos para ese período.");
      const summary = whatIfSummary({ invested, startBar: start, lastBar: last, startDate: date });
      setResult(summary);
      const benches = [
        { name: "S&P 500 (SPY)", symbol: BENCHMARKS.sp500 },
        { name: "Nasdaq (QQQ)", symbol: BENCHMARKS.nasdaq },
        { name: "MERVAL", symbol: BENCHMARKS.merval },
      ];
      const out = [];
      for (const b of benches) {
        try {
          const h = await fetchHistoryBetween(b.symbol, date, to);
          const s = findBarOnOrAfter(h.bars, date);
          const l = h.bars[h.bars.length - 1];
          if (s && l) {
            out.push({
              name: b.name,
              returnPercent: ((l.close / s.close) - 1) * 100,
            });
          }
        } catch {
          /* benchmark opcional */
        }
      }
      setBench(out);
      mark("vs-spy");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo simular");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">¿Qué habría pasado si...?</h1>
      <p className="text-sm text-muted">
        Calcula una compra única en el pasado con precios históricos. No predice el futuro. Una
        ganancia pasada no garantiza ganancias futuras.
      </p>
      {demo && <p className="rounded-lg bg-demo/15 px-3 py-2 text-sm text-demo">DATOS DE DEMOSTRACIÓN</p>}
      <div className="card grid gap-3 p-4 sm:grid-cols-2">
        <label className="text-sm">
          Activo
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2">
            {assets.map((a) => (
              <option key={a.symbol} value={a.symbol}>
                {a.symbol} — {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Fecha inicial
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2" />
        </label>
        <label className="text-sm">
          Capital inicial ({findAsset(symbol)?.currency ?? "USD"})
          <input value={capital} onChange={(e) => setCapital(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 num" />
        </label>
        <button className="self-end rounded-xl bg-accent py-2 font-medium text-black" onClick={run} disabled={loading}>
          {loading ? "Calculando…" : "Simular"}
        </button>
      </div>
      {error && <p className="text-loss">{error}</p>}
      {result && (
        <div className="card space-y-2 p-5">
          {(() => {
            const curr = findAsset(symbol)?.currency ?? "USD";
            return (
              <>
                <p>
                  Invertiste {formatMoney(Number(capital.replace(",", ".")), curr)} el{" "}
                  {new Date(date).toLocaleDateString("es-AR")}. Hoy tendrías aproximadamente{" "}
                  <strong>{formatMoney(result.currentValue, curr)}</strong>. Rendimiento:{" "}
                  <strong>{formatPercent(result.returnPercent)}</strong> ({signedMoney(result.gain, curr)}).
                </p>
                <p className="text-sm text-muted">
                  Precio inicial {formatMoney(result.startPrice, curr)} · unidades ≈{" "}
                  {result.shares.toLocaleString("es-AR", { maximumFractionDigits: 4 })} · precio reciente{" "}
                  {formatMoney(result.lastPrice, curr)}.
                </p>
              </>
            );
          })()}
          {bench.length > 0 && (
            <div className="mt-4">
              <h2 className="font-medium">Comparación en el mismo período</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {bench.map((b) => (
                  <li key={b.name} className="flex justify-between">
                    <span>{b.name}</span>
                    <span className="num">{formatPercent(b.returnPercent)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-muted">
        Si querés simular aportes periódicos mes a mes, usá la sección Inversión mensual (DCA).
      </p>
    </div>
  );
}
