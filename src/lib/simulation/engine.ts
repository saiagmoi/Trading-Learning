import { findAsset } from "@/lib/assets";
import { assertExecutableQuote } from "@/lib/simulation/execution";
import { applyExecution } from "@/lib/simulation/realism";
import type {
  CashBalances,
  CommissionConfig,
  Currency,
  Order,
  Portfolio,
  Position,
  Price,
  RealismLevel,
  Trade,
} from "@/lib/types";

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function emptyPortfolio(cash: CashBalances): Portfolio {
  return {
    cash: { ...cash },
    positions: [],
    orders: [],
    trades: [],
    watchlist: [],
    equityHistory: [{ time: Math.floor(Date.now() / 1000), valueUsd: cash.USD }],
    challenges: [],
    badges: [],
    xp: 0,
  };
}

export interface Preview {
  fillPrice: number;
  commission: number;
  gross: number;
  total: number;
  remainingCash: number;
  estimatedPnl?: number;
  currency: Currency;
}

export function previewOrder(
  portfolio: Portfolio,
  symbol: string,
  side: "buy" | "sell",
  quantity: number,
  lastPrice: number,
  config: CommissionConfig,
): Preview {
  const asset = findAsset(symbol);
  if (!["buy", "sell"].includes(side)) throw new Error("Elegí comprar o vender.");
  if (!asset) throw new Error(`Activo desconocido: ${symbol}`);
  if (asset.type === "index") throw new Error("Los índices no se pueden comprar directamente.");
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("La cantidad tiene que ser válida y mayor a 0.");
  if (!Number.isFinite(lastPrice) || lastPrice <= 0) throw new Error("El precio debe ser válido y mayor a 0.");
  if (Object.values(config).some((n) => !Number.isFinite(n) || n < 0)) throw new Error("Los costos configurados no son válidos.");
  const exec = applyExecution(
    lastPrice,
    quantity,
    side,
    asset.currency,
    asset.market,
    config,
  );
  const cash = portfolio.cash[asset.currency] - reservedCash(portfolio, asset.currency, config);
  const pos = portfolio.positions.find((p) => p.symbol === symbol);
  if (side === "sell") {
    if (!pos || availableQuantity(portfolio, symbol) + 1e-8 < quantity) {
      throw new Error("No tenés suficientes unidades para vender.");
    }
    if (exec.total < 0) throw new Error("El importe de venta no cubre la comisión mínima.");
    const estimatedPnl = (exec.fillPrice - pos.averagePrice) * quantity - exec.commission;
    return {
      fillPrice: exec.fillPrice,
      commission: exec.commission,
      gross: exec.gross,
      total: exec.total,
      remainingCash: cash + exec.total,
      estimatedPnl,
      currency: asset.currency,
    };
  }
  if (cash < exec.total) {
    throw new Error(`Saldo insuficiente en ${asset.currency}.`);
  }
  return {
    fillPrice: exec.fillPrice,
    commission: exec.commission,
    gross: exec.gross,
    total: exec.total,
    remainingCash: cash - exec.total,
    currency: asset.currency,
  };
}

export function executeMarket(
  portfolio: Portfolio,
  symbol: string,
  side: "buy" | "sell",
  quantity: number,
  lastPrice: number,
  config: CommissionConfig,
  realismLevel: RealismLevel,
  context: { quote: Price; now?: Date; limitPrice?: number },
): { portfolio: Portfolio; trade: Trade; order: Order } {
  const clock = context.now ?? new Date();
  assertExecutableQuote(symbol, context.quote, clock);
  if (lastPrice !== context.quote.price) throw new Error("El precio debe coincidir con la cotización verificada.");
  const preview = previewOrder(portfolio, symbol, side, quantity, lastPrice, config);
  if (context.limitPrice != null && (!Number.isFinite(context.limitPrice) || context.limitPrice <= 0 || (side === "buy" ? preview.fillPrice > context.limitPrice : preview.fillPrice < context.limitPrice))) throw new Error("El precio de ejecución no respeta el límite.");
  const asset = findAsset(symbol)!;
  const now = clock.toISOString();
  const order: Order = {
    id: id("ord"),
    symbol,
    side,
    type: "market",
    quantity,
    status: "filled",
    createdAt: now,
    filledAt: now,
    fillPrice: preview.fillPrice,
    commission: preview.commission,
  };
  const next = structuredClone(portfolio) as Portfolio;
  let realized: number | undefined;
  if (side === "buy") {
    next.cash[asset.currency] -= preview.total;
    const pos = next.positions.find((p) => p.symbol === symbol);
    if (pos) {
      const cost = pos.averagePrice * pos.quantity + preview.total;
      pos.quantity += quantity;
      pos.averagePrice = cost / pos.quantity;
    } else {
      next.positions.push({
        symbol,
        quantity,
        averagePrice: preview.total / quantity,
        currency: asset.currency,
        openedAt: now,
      });
    }
  } else {
    next.cash[asset.currency] += preview.total;
    const pos = next.positions.find((p) => p.symbol === symbol)!;
    realized = (preview.fillPrice - pos.averagePrice) * quantity - preview.commission;
    pos.quantity -= quantity;
    if (pos.quantity <= 1e-8) {
      next.positions = next.positions.filter((p) => p.symbol !== symbol);
    }
  }
  const trade: Trade = {
    id: id("trd"),
    orderId: order.id,
    symbol,
    side,
    quantity,
    price: preview.fillPrice,
    commission: preview.commission,
    total: preview.total,
    currency: asset.currency,
    realizedPnl: realized,
    createdAt: now,
    realismLevel,
  };
  next.trades = [trade, ...next.trades];
  next.orders = [order, ...next.orders];
  return { portfolio: next, trade, order };
}

export function reservedCash(portfolio: Portfolio, currency: Currency, config: CommissionConfig): number {
  return portfolio.orders.filter((o) => o.status === "pending" && o.side === "buy" && findAsset(o.symbol)?.currency === currency).reduce((sum, o) => {
    if (o.reservedCash != null) return sum + o.reservedCash;
    const asset = findAsset(o.symbol)!;
    const price = o.limitPrice ?? o.stopPrice ?? 0;
    return sum + applyExecution(price, o.quantity, "buy", currency, asset.market, { ...config, spreadBps: 0, slippageBps: 0 }).total;
  }, 0);
}
export function availableQuantity(portfolio: Portfolio, symbol: string): number {
  const held = portfolio.positions.find((p) => p.symbol === symbol)?.quantity ?? 0;
  return Math.max(0, held - portfolio.orders.filter((o) => o.status === "pending" && o.side === "sell" && o.symbol === symbol).reduce((sum, o) => sum + o.quantity, 0));
}
export function placeWorkingOrder(
  portfolio: Portfolio,
  order: Omit<Order, "id" | "status" | "createdAt">,
  config: CommissionConfig,
): Portfolio {
  const asset = findAsset(order.symbol);
  if (!asset || asset.type === "index") throw new Error("Activo no operable.");
  if (!Number.isFinite(order.quantity) || order.quantity <= 0 || !["buy", "sell"].includes(order.side)) throw new Error("Cantidad o sentido inválido.");
  if (!["limit", "stop", "take_profit"].includes(order.type)) throw new Error("Tipo de orden pendiente inválido.");
  if (order.type !== "limit" && order.side !== "sell") throw new Error("Stop loss y take profit solo están disponibles para vender posiciones existentes.");
  const price = order.type === "stop" ? order.stopPrice : order.limitPrice;
  if (price == null || !Number.isFinite(price) || price <= 0) throw new Error("Ingresá un precio límite o stop válido y mayor a cero.");
  if (Object.values(config).some((n) => !Number.isFinite(n) || n < 0)) throw new Error("Costos inválidos.");
  let reserve: number | undefined;
  if (order.side === "buy") {
    reserve = applyExecution(price, order.quantity, "buy", asset.currency, asset.market, { ...config, spreadBps: 0, slippageBps: 0 }).total;
    if (portfolio.cash[asset.currency] - reservedCash(portfolio, asset.currency, config) + 1e-8 < reserve) throw new Error("Saldo disponible insuficiente: otras órdenes pendientes ya reservan parte del efectivo.");
  } else if (availableQuantity(portfolio, order.symbol) + 1e-8 < order.quantity) throw new Error("Unidades insuficientes: descontá las reservadas por otras órdenes de venta.");
  const next = structuredClone(portfolio) as Portfolio;
  next.orders.unshift({ ...order, reservedCash: reserve, timeInForce: "gtc", id: id("ord"), status: "pending", createdAt: new Date().toISOString() });
  return next;
}
export function cancelOrder(portfolio: Portfolio, orderId: string): Portfolio {
  const next = structuredClone(portfolio) as Portfolio;
  next.orders = next.orders.map((o) => o.id === orderId && o.status === "pending" ? { ...o, status: "cancelled" } : o);
  return next;
}
export function matchPendingOrders(
  portfolio: Portfolio, quotes: Price[], config: CommissionConfig, realismLevel: RealismLevel, now = new Date(),
): Portfolio {
  let current = portfolio;
  // FIFO: earlier orders get the first opportunity to execute.
  const pending = current.orders.filter((o) => o.status === "pending").slice().reverse();
  for (const order of pending) {
    const q = quotes.find((x) => x.symbol === order.symbol);
    if (!q) continue;
    try { assertExecutableQuote(order.symbol, q, now); } catch { continue; }
    const asset = findAsset(order.symbol)!;
    const execution = applyExecution(q.price, order.quantity, order.side, asset.currency, asset.market, config);
    const isLimit = order.type === "limit" || order.type === "take_profit";
    if (isLimit) {
      if (!Number.isFinite(order.limitPrice) || order.limitPrice! <= 0) continue;
      if (order.side === "buy" ? execution.fillPrice > order.limitPrice! : execution.fillPrice < order.limitPrice!) continue;
    } else if (order.type === "stop") {
      if (!Number.isFinite(order.stopPrice) || order.stopPrice! <= 0 || (order.side === "sell" ? q.price > order.stopPrice! : q.price < order.stopPrice!)) continue;
    } else continue;
    try {
      // Release this order's reservation only; all other commitments remain protected.
      const executable = { ...current, orders: current.orders.filter((o) => o.id !== order.id) };
      const result = executeMarket(executable, order.symbol, order.side, order.quantity, q.price, config, realismLevel, { quote: q, now, limitPrice: isLimit ? order.limitPrice : undefined });
      const filled: Order = { ...order, status: "filled", filledAt: now.toISOString(), fillPrice: result.trade.price, commission: result.trade.commission };
      result.trade.orderId = order.id;
      result.portfolio.trades[0].orderId = order.id;
      result.portfolio.orders = [filled, ...result.portfolio.orders.filter((o) => o.id !== result.order.id)];
      current = result.portfolio;
    } catch (err) {
      current = structuredClone(current) as Portfolio;
      current.orders = current.orders.map((o) => o.id === order.id ? { ...o, status: "rejected", rejectReason: err instanceof Error ? err.message : "No se pudo ejecutar" } : o);
    }
  }
  return current;
}

export function portfolioValueUsd(
  positions: Position[],
  quotes: Price[],
  cash: CashBalances,
  usdArs: number | null,
): number {
  let investedUsd = 0;
  for (const p of positions) {
    const q = quotes.find((x) => x.symbol === p.symbol);
    const px = q?.price ?? p.averagePrice;
    const native = px * p.quantity;
    if (p.currency === "USD") investedUsd += native;
    else if (usdArs) investedUsd += native / usdArs;
  }
  let cashUsd = cash.USD;
  if (usdArs) cashUsd += cash.ARS / usdArs;
  return investedUsd + cashUsd;
}

export function addCash(portfolio: Portfolio, amount: number, currency: Currency): Portfolio {
  if (amount <= 0) throw new Error("El monto tiene que ser mayor a 0.");
  const next = structuredClone(portfolio) as Portfolio;
  next.cash[currency] += amount;
  return next;
}
