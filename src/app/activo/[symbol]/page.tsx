"use client";

import { use, useEffect, useState } from "react";
import { Freshness } from "@/components/Freshness";
import { PriceChart } from "@/components/PriceChart";
import { TradeTicket } from "@/components/TradeTicket";
import { fetchNews, fetchQuotes } from "@/lib/api";
import { findAsset } from "@/lib/assets";
import { formatDateTime, formatMoney, formatNumber, formatPercent, formatVolume, pnlClass } from "@/lib/format";
import { useMarketSession } from "@/hooks/useMarketSession";
import type { QuoteNewsItem } from "@/lib/types";
import { useSimulation } from "@/store/simulation-store";

export default function AssetPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = use(params);
  const symbol = decodeURIComponent(raw);
  const asset = findAsset(symbol);
  const quote = useSimulation((s) => s.lastQuotes[symbol]);
  const updateQuotes = useSimulation((s) => s.updateQuotes);
  const watch = useSimulation((s) => s.portfolio.watchlist.some((w) => w.symbol === symbol));
  const toggle = useSimulation((s) => s.toggleWatch);
  const beginner = useSimulation((s) => s.profile?.beginnerMode);
  const hours = useMarketSession(asset?.market ?? "US");
  const [news, setNews] = useState<QuoteNewsItem[] | null>(null);

  useEffect(() => {
    fetchQuotes([symbol])
      .then((r) => updateQuotes(r.quotes))
      .catch(() => undefined);
    fetchNews(symbol)
      .then((r) => setNews(r.available ? r.items : []))
      .catch(() => setNews([]));
  }, [symbol, updateQuotes]);

  if (!asset) {
    return (
      <p className="text-muted">
        No encontramos {symbol} en el catálogo local. Probá buscarlo; si Yahoo lo conoce, se puede
        incorporar.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">
            {asset.market === "US" ? "🇺🇸 Estados Unidos" : "🇦🇷 Argentina"} · {asset.exchange} ·{" "}
            {asset.type === "etf" ? "ETF" : asset.type === "index" ? "Índice" : "Acción"}
          </p>
          <h1 className="text-3xl font-semibold">
            <span className="num">{asset.symbol}</span>{" "}
            <span className="text-xl font-normal text-muted">{asset.name}</span>
          </h1>
          {quote && (
            <p className={`num mt-2 text-4xl ${pnlClass(quote.change)}`}>
              {formatMoney(quote.price, quote.currency)}
            </p>
          )}
          {quote && (
            <p className={`mt-1 ${pnlClass(quote.change)}`}>
              {quote.change >= 0 ? "+" : ""}
              {formatNumber(quote.change)} ({formatPercent(quote.changePercent)})
            </p>
          )}
        </div>
        <div className="space-y-2 text-right">
          <p>
            {hours.isOpen ? "🟢" : "⚪"} {hours.label}
          </p>
          <button className="rounded-xl border border-line px-3 py-2 text-sm" onClick={() => toggle(symbol)}>
            {watch ? "★ En seguimiento" : "☆ Seguir"}
          </button>
        </div>
      </div>
      {quote && (
        <Freshness freshness={quote.freshness} lastUpdated={quote.lastUpdated} source={quote.sourceLabel} />
      )}
      {quote && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Máximo del día" value={quote.dayHigh != null ? formatNumber(quote.dayHigh) : "—"} />
          <Kpi label="Mínimo del día" value={quote.dayLow != null ? formatNumber(quote.dayLow) : "—"} />
          <Kpi label="Volumen" value={formatVolume(quote.volume)} />
          <Kpi
            label={beginner ? "Tamaño de la empresa (market cap)" : "Market cap"}
            value={quote.marketCap ? formatVolume(quote.marketCap) : "—"}
          />
          <Kpi
            label={beginner ? "P/E · precio sobre ganancias" : "P/E"}
            value={quote.peRatio != null ? formatNumber(quote.peRatio) : "—"}
            hint={beginner ? "Cuánto pagás por cada unidad de ganancia. No alcanza para decidir." : undefined}
          />
          <Kpi
            label="Dividend yield"
            value={quote.dividendYield != null ? `${formatNumber(quote.dividendYield)}%` : "—"}
          />
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <PriceChart symbol={symbol} />
        {asset.type !== "index" ? (
          <TradeTicket symbol={symbol} />
        ) : (
          <div className="card p-4 text-sm text-muted">
            Los índices no se compran directo en este simulador. Usá ETFs como SPY o QQQ para practicar.
          </div>
        )}
      </div>
      {news && news.length > 0 && (
        <section className="card p-4">
          <h2 className="font-medium">Noticias</h2>
          <p className="text-xs text-muted">Fuente: Yahoo Finance. No se generan noticias.</p>
          <ul className="mt-3 space-y-3">
            {news.map((n) => (
              <li key={n.url}>
                <a href={n.url} target="_blank" rel="noreferrer" className="hover:text-accent">
                  {n.title}
                </a>
                <p className="text-xs text-muted">
                  {n.publisher} · {formatDateTime(n.publishedAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-muted">
        Los resultados del simulador pueden diferir de una inversión real. El objetivo es aprender.
      </p>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="num mt-1 text-lg">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
