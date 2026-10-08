"use client";

import Link from "next/link";
import { useState } from "react";
import { getIndices } from "@/lib/assets";
import { formatMoney, formatPercent, pnlClass, signedMoney } from "@/lib/format";
import { positionMetrics } from "@/lib/simulation/analytics";
import { portfolioValueUsd } from "@/lib/simulation/engine";
import { useSimulation } from "@/store/simulation-store";

export default function DashboardPage() {
  const portfolio = useSimulation((s) => s.portfolio);
  const quotes = useSimulation((s) => s.lastQuotes);
  const fx = useSimulation((s) => s.lastFx);
  const profile = useSimulation((s) => s.profile);
  const addVirtualCash = useSimulation((s) => s.addVirtualCash);
  const [cashModal, setCashModal] = useState(false);
  const [cashCurrency, setCashCurrency] = useState<"USD" | "ARS">("USD");
  const [cashCustom, setCashCustom] = useState("");
  const beginner = profile?.beginnerMode ?? true;
  const qlist = Object.values(quotes);
  const valueUsd = portfolioValueUsd(portfolio.positions, qlist, portfolio.cash, fx?.rate ?? null);
  const initial = profile?.initialCapital.USD ?? 10000;
  const ret = initial ? ((valueUsd - initial) / initial) * 100 : 0;
  const metrics = positionMetrics(portfolio, qlist);
  const investedUsd = metrics.reduce((a, m) => {
    if (m.currency === "USD") return a + m.value;
    return a + (fx?.rate ? m.value / fx.rate : 0);
  }, 0);
  const dayPnl = metrics.reduce((a, m) => {
    if (m.currency === "USD") return a + m.dayPnl;
    return a + (fx?.rate ? m.dayPnl / fx.rate : 0);
  }, 0);
  const indices = getIndices();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inicio</h1>
          <p className="text-sm text-muted">
            {beginner
              ? "Tu dinero virtual disponible, lo invertido y cuánto ganaste o perdiste — todo ficticio."
              : "Panel de simulación. Modo SIMULATION activo. LIVE TRADING deshabilitado."}
          </p>
        </div>
        <button
          onClick={() => setCashModal(true)}
          className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/20"
        >
          + Agregar dinero virtual
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={beginner ? "Tu patrimonio virtual" : "Mi patrimonio"}
          value={formatMoney(valueUsd, "USD")}
          hint="Suma de efectivo e inversiones, expresada en USD."
        />
        <Stat
          label="Rendimiento"
          value={formatPercent(ret)}
          color={pnlClass(ret)}
          hint="Desde el capital inicial de la simulación."
        />
        <div className="card p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">{beginner ? "Tu dinero virtual disponible" : "Dinero disponible"}</p>
              <button
                onClick={() => setCashModal(true)}
                className="text-xs text-accent hover:underline"
              >
                + Cargar
              </button>
            </div>
            <p className="num mt-1 text-2xl">{formatMoney(portfolio.cash.USD, "USD")}</p>
            <p className="mt-1 text-xs text-muted">ARS {formatMoney(portfolio.cash.ARS, "ARS")}</p>
          </div>
        </div>
        <Stat
          label={beginner ? "Esto es lo que tenés invertido" : "Invertido"}
          value={formatMoney(investedUsd, "USD")}
          extra={
            beginner
              ? `Hoy: ${signedMoney(dayPnl, "USD")}`
              : `P&L diario ${signedMoney(dayPnl, "USD")}`
          }
        />
      </div>
      {fx && (
        <p className="text-xs text-muted">
          Tipo de cambio USD/ARS: {fx.rate.toLocaleString("es-AR")} · {new Date(fx.at).toLocaleString("es-AR")} ·{" "}
          {fx.source}
        </p>
      )}
      <section>
        <h2 className="mb-3 text-lg font-medium">Mercados</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {indices.map((idx) => {
            const q = quotes[idx.symbol];
            return (
              <Link key={idx.symbol} href={`/activo/${idx.symbol}`} className="card p-4 hover:bg-bg">
                <p className="text-xs text-muted">{idx.market === "US" ? "🇺🇸" : "🇦🇷"} {idx.name}</p>
                <p className="num mt-1 text-2xl">{q ? q.price.toLocaleString("es-AR", { maximumFractionDigits: 2 }) : "—"}</p>
                {q && (
                  <p className={`text-sm ${pnlClass(q.change)}`}>
                    {formatPercent(q.changePercent)}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="font-medium">Mis posiciones</h2>
          {metrics.length === 0 && <p className="mt-2 text-sm text-muted">Todavía no compraste nada.</p>}
          <ul className="mt-2 divide-y divide-line">
            {metrics.slice(0, 6).map((m) => (
              <li key={m.symbol} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/activo/${m.symbol}`} className="num font-semibold">{m.symbol}</Link>
                <span className={pnlClass(m.pnl)}>{formatPercent(m.pnlPct)}</span>
              </li>
            ))}
          </ul>
          <Link href="/cartera" className="mt-2 inline-block text-sm text-accent">Ver cartera</Link>
        </div>
        <div className="card p-4">
          <h2 className="font-medium">Últimas operaciones</h2>
          {portfolio.trades.length === 0 && <p className="mt-2 text-sm text-muted">Sin operaciones todavía.</p>}
          <ul className="mt-2 divide-y divide-line">
            {portfolio.trades.slice(0, 6).map((t) => (
              <li key={t.id} className="flex justify-between py-2 text-sm">
                <span>{t.side === "buy" ? "Compra" : "Venta"} {t.symbol}</span>
                <span className="num">{formatMoney(t.total, t.currency)}</span>
              </li>
            ))}
          </ul>
          <Link href="/historial" className="mt-2 inline-block text-sm text-accent">Ver historial</Link>
        </div>
      </section>
      <section className="card p-4">
        <h2 className="font-medium">Activos que estoy siguiendo</h2>
        {portfolio.watchlist.length === 0 && (
          <p className="mt-2 text-sm text-muted">Agregá tickers a la watchlist con la estrella en cada ficha.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {portfolio.watchlist.map((w) => {
            const q = quotes[w.symbol];
            return (
              <Link key={w.symbol} href={`/activo/${w.symbol}`} className="rounded-xl border border-line px-3 py-2 text-sm">
                ⭐ {w.symbol}{" "}
                {q && <span className={pnlClass(q.change)}>{formatPercent(q.changePercent)}</span>}
              </Link>
            );
          })}
        </div>
      </section>

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

function Stat({
  label,
  value,
  extra,
  hint,
  color,
}: {
  label: string;
  value: string;
  extra?: string;
  hint?: string;
  color?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`num mt-1 text-2xl ${color ?? ""}`}>{value}</p>
      {extra && <p className="mt-1 text-xs text-muted">{extra}</p>}
      {hint && <p className="mt-2 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
