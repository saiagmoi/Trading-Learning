"use client";

import { useState } from "react";
import { REALISM_PRESETS, realismHint } from "@/lib/simulation/realism";
import type { Currency, RealismLevel } from "@/lib/types";
import { getActiveCommission, useSimulation } from "@/store/simulation-store";

export default function SettingsPage() {
  const profile = useSimulation((s) => s.profile);
  const cash = useSimulation((s) => s.portfolio.cash);
  const setDisplay = useSimulation((s) => s.setDisplayCurrency);
  const setBeginner = useSimulation((s) => s.setBeginnerMode);
  const setRealism = useSimulation((s) => s.setRealism);
  const customCommissions = useSimulation((s) => s.customCommissions);
  const setCustomCommissions = useSimulation((s) => s.setCustomCommissions);
  const addCash = useSimulation((s) => s.addVirtualCash);
  const reset = useSimulation((s) => s.resetSimulation);
  const [custom, setCustom] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetCap, setResetCap] = useState("10000");
  const [currency, setCurrency] = useState<Currency>("USD");

  const activeConfig = getActiveCommission(profile, customCommissions);

  const amounts = [100, 500, 1000, 5000, 10000];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Configuración</h1>
      <p className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm">
        Modo SIMULATION. LIVE TRADING está deshabilitado en esta versión. No hay depósitos, retiros,
        pagos ni conexión con brokers.
      </p>

      <section className="card p-4">
        <h2 className="font-medium">+ Agregar dinero virtual</h2>
        <p className="text-sm text-muted">Exclusivamente ficticio. No hay ningún mecanismo de pago.</p>
        <div className="mt-3 flex gap-2">
          <button
            className={`rounded-lg border px-3 py-1 ${currency === "USD" ? "border-accent" : "border-line"}`}
            onClick={() => setCurrency("USD")}
          >
            USD
          </button>
          <button
            className={`rounded-lg border px-3 py-1 ${currency === "ARS" ? "border-accent" : "border-line"}`}
            onClick={() => setCurrency("ARS")}
          >
            ARS
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          Saldo actual: USD {cash.USD.toLocaleString("es-AR")} · ARS {cash.ARS.toLocaleString("es-AR")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {amounts.map((n) => (
            <button key={n} className="rounded-xl border border-line px-3 py-2 text-sm" onClick={() => addCash(n, currency)}>
              {currency} {n.toLocaleString("es-AR")}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Personalizado"
            className="rounded-xl border border-line bg-bg px-3 py-2 text-sm"
          />
          <button
            className="rounded-xl bg-accent px-4 text-sm font-medium text-black"
            onClick={() => {
              const n = Number(custom.replace(",", "."));
              if (n > 0) addCash(n, currency);
            }}
          >
            Cargar
          </button>
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-medium">Moneda de referencia</h2>
        <div className="flex gap-2">
          {(["USD", "ARS"] as Currency[]).map((c) => (
            <button
              key={c}
              onClick={() => setDisplay(c)}
              className={`rounded-xl border px-3 py-2 ${profile?.displayCurrency === c ? "border-accent" : "border-line"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={profile?.beginnerMode ?? false}
            onChange={(e) => setBeginner(e.target.checked)}
          />
          Modo principiante
        </label>
      </section>

      <section className="card p-4">
        <h2 className="font-medium">Nivel de realismo</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(["beginner", "realistic", "advanced"] as RealismLevel[]).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setRealism(lvl)}
              className={`rounded-xl border p-3 text-left text-sm ${
                profile?.realismLevel === lvl ? "border-accent" : "border-line"
              }`}
            >
              <p className="font-medium">
                {lvl === "beginner" ? "Principiante" : lvl === "realistic" ? "Realista" : "Avanzado"}
              </p>
              <p className="mt-1 text-xs text-muted">{realismHint(lvl)}</p>
              <p className="mt-2 text-xs text-muted">
                Comisión EE.UU. {REALISM_PRESETS[lvl].usPercent}% · AR {REALISM_PRESETS[lvl].arPercent}%
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-medium">Comisiones y costos simulados</h2>
            <p className="text-xs text-muted">
              Valores configurables para practicar el impacto de los costos en el rendimiento. No representan exactamente los de un broker real.
            </p>
          </div>
          {customCommissions && (
            <button
              className="rounded-lg border border-line px-2 py-1 text-xs text-muted hover:text-ink"
              onClick={() => setCustomCommissions(null)}
            >
              Restablecer valores del nivel
            </button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-muted">
            EE.UU. · Comisión (%)
            <input
              type="number"
              step="0.01"
              value={activeConfig.usPercent}
              onChange={(e) =>
                setCustomCommissions({
                  ...activeConfig,
                  usPercent: Math.max(0, Number(e.target.value)),
                })
              }
              className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="text-xs text-muted">
            EE.UU. · Mínimo por orden (USD)
            <input
              type="number"
              step="0.5"
              value={activeConfig.usMin}
              onChange={(e) =>
                setCustomCommissions({
                  ...activeConfig,
                  usMin: Math.max(0, Number(e.target.value)),
                })
              }
              className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="text-xs text-muted">
            Argentina · Comisión (%)
            <input
              type="number"
              step="0.05"
              value={activeConfig.arPercent}
              onChange={(e) =>
                setCustomCommissions({
                  ...activeConfig,
                  arPercent: Math.max(0, Number(e.target.value)),
                })
              }
              className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="text-xs text-muted">
            Argentina · Mínimo por orden (ARS)
            <input
              type="number"
              step="100"
              value={activeConfig.arMin}
              onChange={(e) =>
                setCustomCommissions({
                  ...activeConfig,
                  arMin: Math.max(0, Number(e.target.value)),
                })
              }
              className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="text-xs text-muted">
            Spread simulado (pbs / basis points)
            <input
              type="number"
              step="1"
              value={activeConfig.spreadBps}
              onChange={(e) =>
                setCustomCommissions({
                  ...activeConfig,
                  spreadBps: Math.max(0, Number(e.target.value)),
                })
              }
              className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="text-xs text-muted">
            Slippage simulado (pbs)
            <input
              type="number"
              step="1"
              value={activeConfig.slippageBps}
              onChange={(e) =>
                setCustomCommissions({
                  ...activeConfig,
                  slippageBps: Math.max(0, Number(e.target.value)),
                })
              }
              className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink"
            />
          </label>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="font-medium">Reiniciar simulación</h2>
        <button className="mt-3 rounded-xl border border-loss px-4 py-2 text-loss" onClick={() => setResetOpen(true)}>
          Reiniciar simulación
        </button>
        {resetOpen && (
          <div className="mt-4 rounded-xl border border-loss/40 p-3">
            <p className="text-sm">
              ¿Seguro que querés reiniciar tu cuenta? Se eliminarán todas las operaciones, posiciones y
              estadísticas.
            </p>
            <label className="mt-3 block text-sm">
              Capital inicial (USD)
              <input
                value={resetCap}
                onChange={(e) => setResetCap(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                className="rounded-xl bg-loss px-4 py-2 text-black"
                onClick={() => {
                  reset(Number(resetCap.replace(",", ".")) || 10000);
                  setResetOpen(false);
                }}
              >
                Sí, reiniciar
              </button>
              <button className="rounded-xl border border-line px-4 py-2" onClick={() => setResetOpen(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
