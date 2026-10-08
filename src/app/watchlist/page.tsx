"use client";

import Link from "next/link";
import { Freshness } from "@/components/Freshness";
import { formatMoney, formatPercent, pnlClass } from "@/lib/format";
import { useSimulation } from "@/store/simulation-store";

export default function WatchlistPage() {
  const items = useSimulation((s) => s.portfolio.watchlist);
  const quotes = useSimulation((s) => s.lastQuotes);
  const toggle = useSimulation((s) => s.toggleWatch);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Watchlist</h1>
      {items.length === 0 && <p className="text-muted">Todavía no seguís ningún activo. Abrí una ficha y tocá la estrella.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((w) => {
          const q = quotes[w.symbol];
          return (
            <div key={w.symbol} className="card p-4">
              <div className="flex items-center justify-between">
                <Link href={`/activo/${w.symbol}`} className="num text-xl font-semibold">
                  ⭐ {w.symbol}
                </Link>
                <button className="text-xs text-muted" onClick={() => toggle(w.symbol)}>
                  Quitar
                </button>
              </div>
              {q ? (
                <>
                  <p className="num mt-2 text-2xl">{formatMoney(q.price, q.currency)}</p>
                  <p className={pnlClass(q.change)}>
                    {q.change.toLocaleString("es-AR", { maximumFractionDigits: 2 })} · {formatPercent(q.changePercent)}
                  </p>
                  <div className="mt-2">
                    <Freshness freshness={q.freshness} lastUpdated={q.lastUpdated} />
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">Esperando cotización…</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
