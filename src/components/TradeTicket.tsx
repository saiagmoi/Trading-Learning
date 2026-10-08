"use client";

import { useMemo, useState } from "react";
import { findAsset } from "@/lib/assets";
import { formatMoney, formatNumber, signedMoney } from "@/lib/format";
import type { OrderType } from "@/lib/types";
import { useSimulation } from "@/store/simulation-store";

export function TradeTicket({ symbol }: { symbol: string }) {
  const quote = useSimulation((s) => s.lastQuotes[symbol]);
  const pos = useSimulation((s) => s.portfolio.positions.find((p) => p.symbol === symbol));
  const beginner = useSimulation((s) => s.profile?.beginnerMode);
  const preview = useSimulation((s) => s.preview);
  const placeOrder = useSimulation((s) => s.placeOrder);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<OrderType>("market");
  const [qty, setQty] = useState("1");
  const [limit, setLimit] = useState("");
  const [stop, setStop] = useState("");
  const [confirm, setConfirm] = useState(false);

  const quantity = Number(qty.replace(",", "."));
  const asset = findAsset(symbol);

  const { pv, previewError } = useMemo(() => {
    if (!quote || !Number.isFinite(quantity) || quantity <= 0) {
      return { pv: null, previewError: null };
    }
    try {
      const res = preview(symbol, side, quantity);
      return { pv: res, previewError: null };
    } catch (e) {
      return { pv: null, previewError: e instanceof Error ? e.message : "Error" };
    }
  }, [quote, quantity, side, symbol, preview]);

  if (!quote || !asset) {
    return <div className="card p-4 text-sm text-muted">Esperando cotización…</div>;
  }

  const submit = () => {
    placeOrder({
      symbol,
      side,
      type,
      quantity,
      limitPrice: type === "limit" || type === "take_profit" ? Number(limit.replace(",", ".")) : undefined,
      stopPrice: type === "stop" ? Number(stop.replace(",", ".")) : undefined,
    });
    setConfirm(false);
  };

  return (
    <div className="card p-4">
      <div className="flex gap-2">
        <button
          className={`flex-1 rounded-xl py-2 font-semibold ${side === "buy" ? "bg-gain text-black" : "bg-bg text-muted"}`}
          onClick={() => setSide("buy")}
        >
          Comprar
        </button>
        <button
          className={`flex-1 rounded-xl py-2 font-semibold ${side === "sell" ? "bg-loss text-black" : "bg-bg text-muted"}`}
          onClick={() => setSide("sell")}
        >
          Vender
        </button>
      </div>
      {beginner && (
        <p className="mt-2 text-xs text-muted">
          Comprar usa tu saldo virtual. Vender solo funciona si ya tenés el activo.
        </p>
      )}
      <label className="mt-4 block text-xs text-muted">Tipo de orden</label>
      <select
        className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm"
        value={type}
        onChange={(e) => setType(e.target.value as OrderType)}
      >
        <option value="market">Orden de mercado</option>
        <option value="limit">Orden límite</option>
        <option value="stop">Stop loss</option>
        <option value="take_profit">Take profit</option>
      </select>
      <label className="mt-3 block text-xs text-muted">Cantidad</label>
      <input
        className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 num"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
      />
      {pos && (
        <p className="mt-1 text-xs text-muted">
          Disponible: {formatNumber(pos.quantity, 4)} · Precio promedio {formatMoney(pos.averagePrice, pos.currency)}
        </p>
      )}
      {(type === "limit" || type === "take_profit") && (
        <>
          <label className="mt-3 block text-xs text-muted">Precio límite</label>
          <input
            className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 num"
            value={limit}
            placeholder={String(quote.price)}
            onChange={(e) => setLimit(e.target.value)}
          />
        </>
      )}
      {type === "stop" && (
        <>
          <label className="mt-3 block text-xs text-muted">Precio stop</label>
          <input
            className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 num"
            value={stop}
            onChange={(e) => setStop(e.target.value)}
          />
        </>
      )}
      {previewError && <p className="mt-3 text-xs text-loss">{previewError}</p>}
      {pv && (
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between"><dt>Precio estimado</dt><dd className="num">{formatMoney(pv.fillPrice, pv.currency)}</dd></div>
          <div className="flex justify-between"><dt>Valor</dt><dd className="num">{formatMoney(pv.gross, pv.currency)}</dd></div>
          <div className="flex justify-between"><dt>Comisión simulada</dt><dd className="num">{formatMoney(pv.commission, pv.currency)}</dd></div>
          <div className="flex justify-between font-medium"><dt>Costo / importe total</dt><dd className="num">{formatMoney(pv.total, pv.currency)}</dd></div>
          <div className="flex justify-between"><dt>Saldo restante</dt><dd className="num">{formatMoney(pv.remainingCash, pv.currency)}</dd></div>
          {pv.estimatedPnl != null && (
            <div className="flex justify-between">
              <dt>Ganancia/pérdida estimada</dt>
              <dd className="num">{signedMoney(pv.estimatedPnl, pv.currency)}</dd>
            </div>
          )}
        </dl>
      )}
      <p className="mt-3 text-[11px] text-muted">
        Comisión simulada con fines educativos. No representa exactamente la de un broker real.
      </p>
      {!confirm ? (
        <button
          className="mt-4 w-full rounded-xl bg-accent py-3 font-semibold text-black"
          onClick={() => setConfirm(true)}
          disabled={!pv}
        >
          Revisar operación
        </button>
      ) : (
        <div className="mt-4 rounded-xl border border-warn/40 p-3">
          <p className="text-sm">
            Vas a {side === "buy" ? "comprar" : "vender"} {quantity} {symbol} ({type}). Es dinero
            virtual. ¿Confirmás?
          </p>
          <div className="mt-3 flex gap-2">
            <button className="flex-1 rounded-xl bg-accent py-2 text-sm font-semibold text-black" onClick={submit}>
              {side === "buy" ? "Confirmar compra" : "Confirmar venta"}
            </button>
            <button className="flex-1 rounded-xl border border-line py-2 text-sm" onClick={() => setConfirm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
