"use client";

import { useMemo, useState } from "react";
import { formatDateTime, formatMoney, signedMoney } from "@/lib/format";
import { useSimulation } from "@/store/simulation-store";

export default function HistoryPage() {
  const trades = useSimulation((s) => s.portfolio.trades);
  const orders = useSimulation((s) => s.portfolio.orders);
  const cancel = useSimulation((s) => s.cancel);
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<"all" | "buy" | "sell">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return trades.filter((t) => {
      if (symbol && t.symbol.toLowerCase() !== symbol.toLowerCase()) return false;
      if (side !== "all" && t.side !== side) return false;
      if (from && t.createdAt < from) return false;
      if (to && t.createdAt > to + "T23:59:59") return false;
      return true;
    });
  }, [trades, symbol, side, from, to]);

  const pending = orders.filter((o) => o.status === "pending");

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Historial</h1>
      {pending.length > 0 && (
        <section className="card p-4">
          <h2 className="font-medium">Órdenes pendientes</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {pending.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {o.type} {o.side === "buy" ? "compra" : "venta"} {o.quantity} {o.symbol}
                  {o.limitPrice ? ` @ ${o.limitPrice}` : ""}
                  {o.stopPrice ? ` stop ${o.stopPrice}` : ""}
                </span>
                <button className="text-loss" onClick={() => cancel(o.id)}>
                  Cancelar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          placeholder="Activo"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="rounded-xl border border-line bg-panel px-3 py-2 text-sm"
        />
        <select
          value={side}
          onChange={(e) => setSide(e.target.value as "all" | "buy" | "sell")}
          className="rounded-xl border border-line bg-panel px-3 py-2 text-sm"
        >
          <option value="all">Compra y venta</option>
          <option value="buy">Compra</option>
          <option value="sell">Venta</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-line bg-panel px-3 py-2 text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-line bg-panel px-3 py-2 text-sm" />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th>Hora</th>
              <th>Activo</th>
              <th>Tipo</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th>Comisión</th>
              <th>Importe total</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const d = new Date(t.createdAt);
              return (
                <tr key={t.id} className="border-t border-line">
                  <td className="px-3 py-2">{d.toLocaleDateString("es-AR")}</td>
                  <td>{d.toLocaleTimeString("es-AR")}</td>
                  <td className="num">{t.symbol}</td>
                  <td>{t.side === "buy" ? "Compra" : "Venta"}</td>
                  <td className="num">{t.quantity}</td>
                  <td className="num">{formatMoney(t.price, t.currency)}</td>
                  <td className="num">{formatMoney(t.commission, t.currency)}</td>
                  <td className="num">{formatMoney(t.total, t.currency)}</td>
                  <td className="num">
                    {t.realizedPnl != null ? signedMoney(t.realizedPnl, t.currency) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-4 text-sm text-muted">No hay operaciones con esos filtros.</p>}
      </div>
      <p className="text-xs text-muted">Última coincidencia de formato de fecha: {formatDateTime(new Date())}</p>
    </div>
  );
}
