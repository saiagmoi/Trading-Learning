"use client";

import { useEffect } from "react";
import { fetchFx, fetchQuotes } from "@/lib/api";
import { getIndices } from "@/lib/assets";
import { useSimulation } from "@/store/simulation-store";

export function QuoteFeed() {
  const watchlist = useSimulation((s) => s.portfolio.watchlist);
  const positions = useSimulation((s) => s.portfolio.positions);
  const orders = useSimulation((s) => s.portfolio.orders);
  const updateQuotes = useSimulation((s) => s.updateQuotes);
  const setFx = useSimulation((s) => s.setFx);

  useEffect(() => {
    const symbols = [
      ...getIndices().map((a) => a.symbol),
      ...watchlist.map((w) => w.symbol),
      ...positions.map((p) => p.symbol),
      ...orders.filter((o) => o.status === "pending").map((o) => o.symbol),
      "SPY",
      "QQQ",
      "AAPL",
      "NVDA",
      "GGAL",
      "YPFD",
    ];
    const unique = [...new Set(symbols)];

    let cancelled = false;
    async function tick() {
      try {
        const chunks: string[][] = [];
        for (let i = 0; i < unique.length; i += 10) chunks.push(unique.slice(i, i + 10));
        const all = [];
        for (const chunk of chunks) {
          const res = await fetchQuotes(chunk);
          all.push(...res.quotes);
        }
        if (!cancelled) updateQuotes(all);
      } catch {
        /* el UI muestra el último dato conocido */
      }
      try {
        const fx = await fetchFx();
        if (!cancelled) setFx(fx.fx.rate, fx.fx.lastUpdated, fx.fx.sourceLabel);
      } catch {
        /* sin FX no convertimos ARS */
      }
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [watchlist, positions, orders, updateQuotes, setFx]);

  return null;
}
