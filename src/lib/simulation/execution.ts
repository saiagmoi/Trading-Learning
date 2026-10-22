import { findAsset } from "@/lib/assets";
import { getMarketHours } from "@/lib/market/hours";
import type { Price } from "@/lib/types";

export function assertExecutableQuote(symbol: string, quote: Price, now = new Date()) {
  const asset = findAsset(symbol);
  if (!asset || asset.type === "index") throw new Error("Este instrumento no se puede operar directamente.");
  if (!getMarketHours(asset.market, now).isOpen) throw new Error("Mercado cerrado: no se pueden ejecutar compras ni ventas. Las órdenes límite esperan una rueda habilitada.");
  const observed = new Date(quote.lastUpdated);
  const age = now.getTime() - observed.getTime();
  if (quote.symbol !== symbol || quote.currency !== asset.currency || !Number.isFinite(quote.price) || quote.price <= 0 || !Number.isFinite(age) || age < -60_000 || age > 30 * 60_000 || !getMarketHours(asset.market, observed).isOpen) {
    throw new Error("Se necesita una cotización válida y reciente de la rueda regular para ejecutar. No se usa el precio del cierre anterior.");
  }
}
