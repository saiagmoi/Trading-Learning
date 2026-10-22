"use client";

import { useState } from "react";
import { useMarketSession } from "@/hooks/useMarketSession";
import { assertExecutableQuote } from "@/lib/simulation/execution";
import { availableQuantity } from "@/lib/simulation/engine";
import { findAsset } from "@/lib/assets";
import { formatMoney, formatNumber, signedMoney } from "@/lib/format";
import type { OrderType } from "@/lib/types";
import { useSimulation } from "@/store/simulation-store";

export function TradeTicket({ symbol }: { symbol: string }) {
  const quote = useSimulation((s) => s.lastQuotes[symbol]);
  const portfolio = useSimulation((s) => s.portfolio);
  useSimulation((s) => s.customCommissions);
  useSimulation((s) => s.profile?.realismLevel);
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
  const [message, setMessage] = useState("");

  const quantity = Number(qty.replace(",", "."));
  const asset = findAsset(symbol);

  const session = useMarketSession(asset?.market ?? "US");
  const orderPrices = { type, limitPrice: Number(limit.replace(",", ".")), stopPrice: Number(stop.replace(",", ".")) };
  let pv: ReturnType<typeof preview> | null = null;
  let previewError: string | null = null;
  if (quote && Number.isFinite(quantity) && quantity > 0) {
    try {
      if (type === "market") assertExecutableQuote(symbol, quote, session.now);
      pv = preview(symbol, side, quantity, orderPrices);
    } catch (e) { previewError = e instanceof Error ? e.message : "No se pudo estimar la orden."; }
  }

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
    if (!useSimulation.getState().error) {
      setMessage(type === "market" ? "Operación simulada ejecutada." : "Orden enviada. Queda pendiente hasta cumplir el precio y el horario. Podés verla o cancelarla en Historial.");
    } else {
      setMessage("");
    }
    setConfirm(false);
  };

  return (
    <div className="card p-4">
      <div className="flex gap-2">
        <button
          className={`flex-1 rounded-xl py-2 font-semibold ${side === "buy" ? "bg-gain text-black" : "bg-bg text-muted"}`}
          onClick={() => { setSide("buy"); setType("market"); setConfirm(false); }}
        >
          Comprar
        </button>
        <button
          className={`flex-1 rounded-xl py-2 font-semibold ${side === "sell" ? "bg-loss text-black" : "bg-bg text-muted"}`}
          onClick={() => { setSide("sell"); setConfirm(false); }}
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
        onChange={(e) => { setType(e.target.value as OrderType); setConfirm(false); }}
      >
        <option value="market">Orden de mercado</option>
        <option value="limit">Orden límite</option>
        {side === "sell" && <option value="stop">Stop loss</option>}
        {side === "sell" && <option value="take_profit">Take profit</option>}
      </select>
      <div className="mt-3 rounded-xl border border-line bg-bg p-3 text-xs text-muted">
        <p>{session.isOpen ? "● Rueda regular abierta" : "○ Mercado cerrado: sin ejecuciones"}</p>
        <p className="mt-1">{type === "market" ? "Mercado: opera al precio disponible simulado, que puede cambiar al confirmar. No elegís un precio exacto." : type === "limit" ? "Límite: compra a tu precio o menos; vende a tu precio o más. Las comisiones se suman por separado. No garantiza ejecución." : type === "stop" ? "Stop loss: al tocar el disparador se convierte en venta a mercado. Una caída brusca puede ejecutar por debajo del stop." : "Take profit: orden límite de venta; no se ejecuta por debajo del objetivo."}</p>
        {type !== "market" && <p className="mt-1">Vigencia GTC: hasta ejecutar o cancelar, solo en rueda regular. Con el mercado cerrado queda pendiente.</p>}
      </div>
      <label className="mt-3 block text-xs text-muted">Cantidad</label>
      <input
        className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 num"
        value={qty}
        onChange={(e) => { setQty(e.target.value); setConfirm(false); }}
      />
      {pos && (
        <p className="mt-1 text-xs text-muted">
          Disponible: {formatNumber(availableQuantity(portfolio, symbol), 4)} · Precio promedio {formatMoney(pos.averagePrice, pos.currency)}
        </p>
      )}
      {(type === "limit" || type === "take_profit") && (
        <>
          <label className="mt-3 block text-xs text-muted">Precio límite</label>
          <input
            className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 num"
            value={limit}
            placeholder={String(quote.price)}
            onChange={(e) => { setLimit(e.target.value); setConfirm(false); }}
          />
        </>
      )}
      {type === "stop" && (
        <>
          <label className="mt-3 block text-xs text-muted">Precio stop</label>
          <input
            className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 num"
            value={stop}
            onChange={(e) => { setStop(e.target.value); setConfirm(false); }}
          />
        </>
      )}
      {previewError && <p className="mt-3 text-xs text-loss">{previewError}</p>}
      {message && <p role="status" className="mt-3 text-xs text-gain">{message}</p>}
      {pv && (
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between"><dt>{type === "limit" || type === "take_profit" ? "Precio límite por unidad" : "Precio de mercado estimado"}</dt><dd className="num">{formatMoney(pv.fillPrice, pv.currency)}</dd></div>
          <div className="flex justify-between"><dt>Valor</dt><dd className="num">{formatMoney(pv.gross, pv.currency)}</dd></div>
          <div className="flex justify-between"><dt>Comisión simulada</dt><dd className="num">{formatMoney(pv.commission, pv.currency)}</dd></div>
          <div className="flex justify-between font-medium"><dt>Costo / importe total</dt><dd className="num">{formatMoney(pv.total, pv.currency)}</dd></div>
          <div className="flex justify-between"><dt>Saldo disponible restante</dt><dd className="num">{formatMoney(pv.remainingCash, pv.currency)}</dd></div>
          {pv.estimatedPnl != null && (
            <div className="flex justify-between">
              <dt>Ganancia/pérdida estimada</dt>
              <dd className="num">{signedMoney(pv.estimatedPnl, pv.currency)}</dd>
            </div>
          )}
        </dl>
      )}
      <p className="mt-3 text-[11px] text-muted">
        Datos retrasados: la simulación no reproduce el libro de órdenes, ejecuciones parciales ni prioridad de un broker real. Las órdenes se revisan mientras la app recibe cotizaciones.
      </p>
      {!confirm ? (
        <button
          className="mt-4 w-full rounded-xl bg-accent py-3 font-semibold text-black"
          onClick={() => setConfirm(true)}
          disabled={!pv}
        >
          {type === "market" ? "Revisar operación" : "Revisar orden pendiente"}
        </button>
      ) : (
        <div className="mt-4 rounded-xl border border-warn/40 p-3">
          <p className="text-sm">
            Vas a {side === "buy" ? "comprar" : "vender"} {quantity} {symbol} ({type}). Es dinero
            virtual. {type !== "market" && "Es una orden pendiente; no garantiza una operación inmediata."} ¿Confirmás?
          </p>
          <div className="mt-3 flex gap-2">
            <button className="flex-1 rounded-xl bg-accent py-2 text-sm font-semibold text-black" onClick={submit} disabled={!pv || (type === "market" && !session.isOpen)}>
              {type !== "market" ? "Enviar orden pendiente" : side === "buy" ? "Confirmar compra" : "Confirmar venta"}
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
