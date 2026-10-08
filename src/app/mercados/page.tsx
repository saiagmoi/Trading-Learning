"use client";

import Link from "next/link";
import { useEffect } from "react";
import { fetchQuotes } from "@/lib/api";
import { getCatalogAssets } from "@/lib/assets";
import { formatMoney, formatPercent, formatVolume, pnlClass } from "@/lib/format";
import { useSimulation } from "@/store/simulation-store";

export default function MarketsPage() {
  const quotes = useSimulation((s) => s.lastQuotes);
  const updateQuotes = useSimulation((s) => s.updateQuotes);
  const assets = getCatalogAssets();

  useEffect(() => {
    const symbols = assets.map((a) => a.symbol);
    let cancelled = false;
    (async () => {
      try {
        for (let i = 0; i < symbols.length; i += 8) {
          const res = await fetchQuotes(symbols.slice(i, i + 8));
          if (!cancelled) updateQuotes(res.quotes);
        }
      } catch {
        /* se muestran los últimos valores */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assets, updateQuotes]);
  const us = assets.filter((a) => a.market === "US");
  const ar = assets.filter((a) => a.market === "AR");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Mercados</h1>
        <p className="text-sm text-muted">
          Catálogo inicial configurable en <span className="num">src/data/assets.json</span>. El buscador
          puede incorporar más instrumentos.
        </p>
      </div>
      <MarketTable title="🇺🇸 Estados Unidos — acciones y ETFs" rows={us} quotes={quotes} />
      <MarketTable title="🇦🇷 Argentina — BYMA / Merval" rows={ar} quotes={quotes} />
    </div>
  );
}

function MarketTable({
  title,
  rows,
  quotes,
}: {
  title: string;
  rows: ReturnType<typeof getCatalogAssets>;
  quotes: ReturnType<typeof useSimulation.getState>["lastQuotes"];
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">{title}</h2>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="px-3 py-2">Activo</th>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Var.</th>
              <th>Var. %</th>
              <th>Volumen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const q = quotes[a.symbol];
              return (
                <tr key={a.symbol} className="border-t border-line hover:bg-bg">
                  <td className="px-3 py-2">
                    <Link className="num font-semibold text-accent" href={`/activo/${a.symbol}`}>
                      {a.symbol}
                    </Link>
                  </td>
                  <td className="max-w-[220px] truncate text-muted">{a.name}</td>
                  <td className="num">{q ? formatMoney(q.price, q.currency) : "—"}</td>
                  <td className={`num ${q ? pnlClass(q.change) : ""}`}>
                    {q ? q.change.toLocaleString("es-AR", { maximumFractionDigits: 2 }) : "—"}
                  </td>
                  <td className={`num ${q ? pnlClass(q.change) : ""}`}>
                    {q ? formatPercent(q.changePercent) : "—"}
                  </td>
                  <td className="num">{q ? formatVolume(q.volume) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
