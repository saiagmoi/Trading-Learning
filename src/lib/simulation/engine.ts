import { findAsset } from "@/lib/assets";
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
  if (!asset) throw new Error(`Activo desconocido: ${symbol}`);
  if (quantity <= 0) throw new Error("La cantidad tiene que ser mayor a 0.");
  const exec = applyExecution(
    lastPrice,
    quantity,
    side,
    asset.currency,
    asset.market,
    config,
  );
  const cash = portfolio.cash[asset.currency];
  const pos = portfolio.positions.find((p) => p.symbol === symbol);
  if (side === "sell") {
    if (!pos || pos.quantity < quantity) {
      throw new Error("No tenés suficientes unidades para vender.");
    }
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
): { portfolio: Portfolio; trade: Trade; order: Order } {
  const preview = previewOrder(portfolio, symbol, side, quantity, lastPrice, config);
  const asset = findAsset(symbol)!;
  const now = new Date().toISOString();
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
      const cost = pos.averagePrice * pos.quantity + preview.gross;
      pos.quantity += quantity;
      pos.averagePrice = cost / pos.quantity;
    } else {
      next.positions.push({
        symbol,
        quantity,
        averagePrice: preview.fillPrice,
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

export function placeWorkingOrder(
  portfolio: Portfolio,
  order: Omit<Order, "id" | "status" | "createdAt">,
): Portfolio {
  const next = structuredClone(portfolio) as Portfolio;
  const full: Order = {
    ...order,
    id: id("ord"),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  next.orders = [full, ...next.orders];
  return next;
}

export function cancelOrder(portfolio: Portfolio, orderId: string): Portfolio {
  const next = structuredClone(portfolio) as Portfolio;
  next.orders = next.orders.map((o) =>
    o.id === orderId && o.status === "pending" ? { ...o, status: "cancelled" } : o,
  );
  return next;
}

function orderTriggered(order: Order, last: number): boolean {
  if (order.type === "limit" && order.limitPrice != null) {
    return order.side === "buy" ? last <= order.limitPrice : last >= order.limitPrice;
  }
  if (order.type === "stop" && order.stopPrice != null) {
    return order.side === "sell" ? last <= order.stopPrice : last >= order.stopPrice;
  }
  if (order.type === "take_profit" && order.limitPrice != null) {
    return order.side === "sell" && last >= order.limitPrice;
  }
  return false;
}

export function matchPendingOrders(
  portfolio: Portfolio,
  quotes: Price[],
  config: CommissionConfig,
  realismLevel: RealismLevel,
): Portfolio {
  let current = portfolio;
  const pending = current.orders.filter((o) => o.status === "pending");
  for (const order of pending) {
    const q = quotes.find((x) => x.symbol === order.symbol);
    if (!q) continue;
    if (!orderTriggered(order, q.price)) continue;
    try {
      const result = executeMarket(
        current,
        order.symbol,
        order.side,
        order.quantity,
        q.price,
        config,
        realismLevel,
      );
      result.portfolio.orders = result.portfolio.orders.map((o) => {
        if (o.id === order.id) {
          return {
            ...o,
            status: "filled",
            filledAt: new Date().toISOString(),
            fillPrice: result.trade.price,
            commission: result.trade.commission,
          };
        }
        if (o.id === result.order.id) return o;
        return o;
      });
      result.portfolio.orders = result.portfolio.orders.filter(
        (o) => o.id !== result.order.id,
      );
      current = result.portfolio;
    } catch (err) {
      current = structuredClone(current) as Portfolio;
      current.orders = current.orders.map((o) =>
        o.id === order.id
          ? {
              ...o,
              status: "rejected",
              rejectReason: err instanceof Error ? err.message : "No se pudo ejecutar",
            }
          : o,
      );
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
