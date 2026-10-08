"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoney, formatPercent, pnlClass, signedMoney } from "@/lib/format";
import { positionMetrics } from "@/lib/simulation/analytics";
import { portfolioValueUsd } from "@/lib/simulation/engine";
import { useSimulation } from "@/store/simulation-store";

export default function PortfolioPage() {
  const portfolio = useSimulation((s) => s.portfolio);
  const quotes = Object.values(useSimulation((s) => s.lastQuotes));
  const fx = useSimulation((s) => s.lastFx);
  const profile = useSimulation((s) => s.profile);
  const addVirtualCash = useSimulation((s) => s.addVirtualCash);
  const [cashModal, setCashModal] = useState(false);
  const [cashCurrency, setCashCurrency] = useState<"USD" | "ARS">("USD");
  const [cashCustom, setCashCustom] = useState("");
  const beginner = profile?.beginnerMode;
  const metrics = positionMetrics(portfolio, quotes);
  const valueUsd = portfolioValueUsd(portfolio.positions, quotes, portfolio.cash, fx?.rate ?? null);
  const initial = profile?.initialCapital.USD ?? 10000;
  const totalPnl = valueUsd - initial;
  const ret = initial ? (totalPnl / initial) * 100 : 0;
  const day = metrics.reduce((a, m) => a + (m.currency === "USD" ? m.dayPnl : fx?.rate ? m.dayPnl / fx.rate : 0), 0);
  const invested = metrics.reduce(
    (a, m) => a + (m.currency === "USD" ? m.value : fx?.rate ? m.value / fx.rate : 0),
    0,
  );
  const isArs = profile?.displayCurrency === "ARS";
  const valueRef = isArs && fx?.rate ? valueUsd * fx.rate : valueUsd;
  const refCurrency = isArs ? "ARS" : "USD";

  const spark = useMemo(() => {
    const h = portfolio.equityHistory;
    if (h.length < 2) return "";
    const min = Math.min(...h.map((p) => p.valueUsd));
    const max = Math.max(...h.map((p) => p.valueUsd));
    const w = 600;
    const ht = 120;
    return h
      .map((p, i) => {
        const x = (i / (h.length - 1)) * w;
        const y = ht - ((p.valueUsd - min) / (max - min || 1)) * ht;
        return `${x},${y}`;
      })
      .join(" ");
  }, [portfolio.equityHistory]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Mi cartera</h1>
        <button
          onClick={() => setCashModal(true)}
          className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/20"
        >
          + Agregar dinero virtual
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Box
          label={isArs ? "Valor total (ARS ref.)" : "Valor total (USD)"}
          value={formatMoney(valueRef, refCurrency)}
          extra={isArs ? `Equivalente: ${formatMoney(valueUsd, "USD")}` : undefined}
        />
        <Box label="Dinero disponible USD" value={formatMoney(portfolio.cash.USD, "USD")} />
        <Box label="Dinero disponible ARS" value={formatMoney(portfolio.cash.ARS, "ARS")} />
        <Box label="Dinero invertido (USD est.)" value={formatMoney(invested, "USD")} />
        <Box
          label={beginner ? "Esto es cuánto ganaste o perdiste" : "Ganancia/pérdida total"}
          value={signedMoney(totalPnl, "USD")}
          color={pnlClass(totalPnl)}
          hint={beginner ? "P&L: Profit & Loss, cuánto ganaste o perdiste con tus inversiones." : undefined}
        />
        <Box label="Ganancia/pérdida diaria" value={signedMoney(day, "USD")} color={pnlClass(day)} />
        <Box label="Rendimiento %" value={formatPercent(ret)} color={pnlClass(ret)} />
        <Box label="Rendimiento desde el inicio" value={signedMoney(totalPnl, "USD")} color={pnlClass(totalPnl)} />
      </div>
      {fx && (
        <p className="text-xs text-muted">
          Las posiciones en ARS se convierten con USD/ARS {fx.rate.toLocaleString("es-AR")} ({fx.source}). No se
          mezclan monedas en silencio.
        </p>
      )}
      <div className="card p-4">
        <h2 className="mb-2 font-medium">Evolución del patrimonio (USD)</h2>
        {spark ? (
          <svg viewBox="0 0 600 120" className="h-32 w-full">
            <polyline fill="none" stroke="#4c8dff" strokeWidth="2" points={spark} />
          </svg>
        ) : (
          <p className="text-sm text-muted">Se arma con el tiempo, a medida que hay cotizaciones.</p>
        )}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="px-3 py-2">Activo</th>
              <th>Cantidad</th>
              <th>Precio promedio</th>
              <th>Precio actual</th>
              <th>Valor</th>
              <th>P&L</th>
              <th>P&L %</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.symbol} className="border-t border-line">
                <td className="px-3 py-2">
                  <Link className="num font-semibold text-accent" href={`/activo/${m.symbol}`}>
                    {m.symbol}
                  </Link>
                  <div className="text-xs text-muted">{m.currency}</div>
                </td>
                <td className="num">{m.quantity.toLocaleString("es-AR")}</td>
                <td className="num">{formatMoney(m.averagePrice, m.currency)}</td>
                <td className="num">{formatMoney(m.price, m.currency)}</td>
                <td className="num">{formatMoney(m.value, m.currency)}</td>
                <td className={`num ${pnlClass(m.pnl)}`}>{signedMoney(m.pnl, m.currency)}</td>
                <td className={`num ${pnlClass(m.pnlPct)}`}>{formatPercent(m.pnlPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {metrics.length === 0 && <p className="p-4 text-sm text-muted">No hay posiciones abiertas.</p>}
      </div>
      {beginner && (
        <p className="text-xs text-muted">
          🟢 verde = ganancia · 🔴 rojo = pérdida. Los números cambian cuando se actualiza el precio.
        </p>
      )}
      {cashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">+ Agregar dinero virtual</h2>
                <p className="mt-1 text-xs text-muted">
                  Exclusivamente dinero ficticio para practicar. No requiere ningún medio de pago.
                </p>
              </div>
              <button
                onClick={() => setCashModal(false)}
                className="text-muted hover:text-ink text-lg"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                className={`rounded-lg border px-3 py-1 text-sm ${cashCurrency === "USD" ? "border-accent bg-bg" : "border-line"}`}
                onClick={() => setCashCurrency("USD")}
              >
                USD
              </button>
              <button
                className={`rounded-lg border px-3 py-1 text-sm ${cashCurrency === "ARS" ? "border-accent bg-bg" : "border-line"}`}
                onClick={() => setCashCurrency("ARS")}
              >
                ARS
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[100, 500, 1000, 5000, 10000].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    addVirtualCash(n, cashCurrency);
                    setCashModal(false);
                  }}
                  className="rounded-xl border border-line p-2 text-sm hover:border-accent hover:bg-bg"
                >
                  +{cashCurrency} {n.toLocaleString("es-AR")}
                </button>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={cashCustom}
                onChange={(e) => setCashCustom(e.target.value)}
                placeholder="Personalizado"
                className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm"
              />
              <button
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-black"
                onClick={() => {
                  const n = Number(cashCustom.replace(",", "."));
                  if (n > 0) {
                    addVirtualCash(n, cashCurrency);
                    setCashCustom("");
                    setCashModal(false);
                  }
                }}
              >
                Cargar
              </button>
            </div>

            <div className="mt-5 text-right">
              <button
                onClick={() => setCashModal(false)}
                className="rounded-xl border border-line px-4 py-2 text-sm text-muted hover:text-ink"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Box({
  label,
  value,
  extra,
  color,
  hint,
}: {
  label: string;
  value: string;
  extra?: string;
  color?: string;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`num mt-1 text-xl ${color ?? ""}`}>{value}</p>
      {extra && <p className="mt-1 text-xs text-muted">{extra}</p>}
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
