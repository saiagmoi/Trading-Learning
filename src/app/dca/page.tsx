"use client";

import { useState } from "react";
import { fetchHistoryBetween } from "@/lib/api";
import { findAsset, getCatalogAssets } from "@/lib/assets";
import { formatMoney, formatPercent, signedMoney } from "@/lib/format";
import { dcaSummary } from "@/lib/simulation/analytics";

export default function DcaPage() {
  const assets = getCatalogAssets();
  const [symbol, setSymbol] = useState("SPY");
  const curr = findAsset(symbol)?.currency ?? "USD";
  const [monthly, setMonthly] = useState("200");
  const [from, setFrom] = useState("2020-01-01");
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [res, setRes] = useState<ReturnType<typeof dcaSummary> | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const h = await fetchHistoryBetween(symbol, from, to);
      setDemo(h.demo);
      const out = dcaSummary({
        monthly: Number(monthly.replace(",", ".")),
        bars: h.bars,
        startIso: from,
        endIso: to,
      });
      setRes(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const spark = res?.points.length
    ? res.points
        .map((p, i) => {
          const max = Math.max(...res.points.map((x) => x.value));
          const min = Math.min(...res.points.map((x) => x.value));
          const x = (i / (res.points.length - 1)) * 600;
          const y = 140 - ((p.value - min) / (max - min || 1)) * 140;
          return `${x},${y}`;
        })
        .join(" ")
    : "";

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Inversión mensual (DCA)</h1>
      <p className="text-sm text-muted">
        Dollar Cost Averaging: el mismo monto, todos los meses. Sirve para ver el efecto de aportar
        en forma periódica. No elimina el riesgo de pérdida.
      </p>
      {demo && <p className="rounded-lg bg-demo/15 px-3 py-2 text-sm text-demo">DATOS DE DEMOSTRACIÓN</p>}
      <div className="card grid gap-3 p-4 sm:grid-cols-2">
        <label className="text-sm">
          Activo
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2">
            {assets.map((a) => (
              <option key={a.symbol} value={a.symbol}>{a.symbol} — {a.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Monto mensual ({curr})
          <input value={monthly} onChange={(e) => setMonthly(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 num" />
        </label>
        <label className="text-sm">
          Fecha inicial
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2" />
        </label>
        <label className="text-sm">
          Fecha final
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2" />
        </label>
        <button className="sm:col-span-2 rounded-xl bg-accent py-2 font-medium text-black" onClick={run} disabled={loading}>
          {loading ? "Calculando…" : "Calcular"}
        </button>
      </div>
      {error && <p className="text-loss">{error}</p>}
      {res && (
        <div className="card p-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <K label="Dinero aportado" v={formatMoney(res.contributed, curr)} />
            <K label="Valor actual" v={formatMoney(res.currentValue, curr)} />
            <K label="Ganancia" v={signedMoney(res.gain, curr)} />
            <K label="Rendimiento" v={formatPercent(res.returnPercent)} />
          </div>
          {spark && (
            <svg viewBox="0 0 600 140" className="mt-4 h-36 w-full">
              <polyline fill="none" stroke="#3dd68c" strokeWidth="2" points={spark} />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}

function K({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="num mt-1 text-lg">{v}</p>
    </div>
  );
}
