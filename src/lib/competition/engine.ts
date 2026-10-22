import { findAsset } from "@/lib/assets";
import { emptyPortfolio, executeMarket, portfolioValueUsd } from "@/lib/simulation/engine";
import { REALISM_PRESETS, applyExecution } from "@/lib/simulation/realism";
import type { HistoricalPrice, Portfolio, Price } from "@/lib/types";
import { AGENT_IDS, type AgentId, type Allocation, type Competition, type ParticipantId, type Proposal } from "./types";

export const PARTICIPANTS: ParticipantId[] = ["you", "spy", ...AGENT_IDS];
export function value(portfolio: Portfolio, quotes: Price[]) {
  return portfolioValueUsd(portfolio.positions, quotes, portfolio.cash, null);
}
export function freshQuote(q: Price, now = Date.now()) {
  const age = now - new Date(q.lastUpdated).getTime();
  return q.currency === "USD" && Number.isFinite(q.price) && q.price > 0 && age >= -60_000 && age <= 30 * 60_000;
}
export function createCompetition(capital: number, model: string, provider: "yahoo" | "demo", now = new Date()): Competition {
  if (!Number.isFinite(capital) || capital < 100 || capital > 1_000_000) throw new Error("Elegí un capital entre USD 100 y USD 1.000.000.");
  return {
    version: 1, id: crypto.randomUUID(), startedAt: now.toISOString(),
    endsAt: new Date(now.getTime() + 42 * 86_400_000).toISOString(), status: "active",
    initialCapital: capital, model, provider, commission: { ...REALISM_PRESETS.realistic },
    portfolios: Object.fromEntries(PARTICIPANTS.map((id) => [id, emptyPortfolio({ USD: capital, ARS: 0 })])) as Record<ParticipantId, Portfolio>,
    quotes: [], decisions: [], lastReview: {}, lastAttempt: {}, patientTargets: null, snapshots: [],
    lastCheckedAt: now.toISOString(), notice: "Ronda creada. SPY y los agentes esperan su primera evaluación con mercado abierto y datos recientes.",
  };
}
export function momentumCandidates(histories: Record<string, HistoricalPrice[]>) {
  return Object.entries(histories).flatMap(([symbol, bars]) => {
    if (bars.length < 61) return [];
    const last = bars.at(-1)!.close;
    const base = bars[bars.length - 61].close;
    const sma50 = bars.slice(-50).reduce((a, b) => a + b.close, 0) / 50;
    const return12w = last / base - 1;
    return Number.isFinite(return12w) && base > 0 && last > sma50 && return12w > 0 ? [{ symbol, return12w, sma50, last }] : [];
  }).sort((a, b) => b.return12w - a.return12w || a.symbol.localeCompare(b.symbol)).slice(0, 5);
}
export function validateProposal(agent: AgentId, raw: unknown, allowed: string[], candidates: string[]): Proposal {
  if (!raw || typeof raw !== "object") throw new Error("La IA no entregó una decisión válida.");
  const p = raw as Proposal;
  if (!["hold", "allocate"].includes(p.action) || typeof p.reason !== "string" || !p.reason.trim() || p.reason.length > 3000 || !Array.isArray(p.allocations)) throw new Error("Formato de decisión inválido.");
  if (p.action === "hold") {
    if (p.allocations.length) throw new Error("Esperar no puede incluir operaciones.");
    return p;
  }
  if (p.allocations.length > 5) throw new Error("Máximo cinco posiciones.");
  const seen = new Set<string>();
  let total = 0;
  for (const a of p.allocations) {
    if (!a || !allowed.includes(a.symbol) || seen.has(a.symbol) || !Number.isFinite(a.weight) || a.weight <= 0 || a.weight > 0.2) throw new Error("Activo o peso fuera de las reglas.");
    seen.add(a.symbol); total += a.weight;
    const asset = findAsset(a.symbol);
    if (agent === "patient" && asset?.type !== "etf") throw new Error("El Paciente solo usa ETFs.");
    if (agent === "analyst" && asset?.type !== "stock") throw new Error("El Analista solo usa acciones.");
    if (agent === "momentum" && !candidates.includes(a.symbol)) throw new Error("La compra no cumple la señal de tendencia.");
  }
  if (total > (agent === "patient" ? 0.8 : 1) + 1e-8) throw new Error("La asignación supera el máximo permitido.");
  return p;
}
export function logDecision(c: Competition, participant: ParticipantId, action: "buy" | "sell" | "hold" | "error" | "review", reason: string, extra = {}) {
  c.decisions.unshift({ id: crypto.randomUUID(), participant, action, reason, at: new Date().toISOString(), ...extra });
}
export function buyWithinBudget(portfolio: Portfolio, symbol: string, budget: number, quote: Price, commission: Competition["commission"]) {
  const limit = Math.min(budget, portfolio.cash.USD);
  const unit = applyExecution(quote.price, 1, "buy", "USD", "US", commission).fillPrice;
  const available = Math.min(limit - commission.usMin, limit / (1 + commission.usPercent / 100));
  return Math.floor(Math.max(0, available / unit) * 1e6) / 1e6;
}
export function trade(c: Competition, who: ParticipantId, symbol: string, side: "buy" | "sell", quantity: number, reason: string, now = Date.now()) {
  const quote = c.quotes.find((q) => q.symbol === symbol);
  if (!quote || !freshQuote(quote, now)) throw new Error("Sin precio reciente válido. Se conserva la cartera.");
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Ingresá una cantidad válida mayor a cero.");
  if (side === "sell" && applyExecution(quote.price, quantity, side, "USD", "US", c.commission).total < 0) throw new Error("La venta no cubre la comisión mínima. Se conserva la posición.");
  const res = executeMarket(c.portfolios[who], symbol, side, quantity, quote.price, c.commission, "realistic", { quote, now: new Date(now) });
  c.portfolios[who] = res.portfolio;
  logDecision(c, who, side, reason, { symbol, quantity, price: res.trade.price, commission: res.trade.commission });
}
export function applyProposal(c: Competition, agent: AgentId, p: Proposal, now = Date.now()) {
  if (p.action === "hold") { logDecision(c, agent, "hold", p.reason, { model: c.model }); return; }
  const portfolio = c.portfolios[agent];
  const total = value(portfolio, c.quotes);
  let targets: Allocation[] = p.allocations;
  if (agent === "patient" && c.patientTargets) {
    targets = c.patientTargets;
    const symbols = new Set([...targets.map((a) => a.symbol), ...portfolio.positions.map((a) => a.symbol)]);
    const drift = [...symbols].some((symbol) => {
      const pos = portfolio.positions.find((a) => a.symbol === symbol);
      const q = c.quotes.find((a) => a.symbol === symbol);
      return Math.abs((pos && q ? pos.quantity * q.price / total : 0) - (targets.find((a) => a.symbol === symbol)?.weight ?? 0)) > 0.05;
    });
    if (!drift) { logDecision(c, agent, "hold", "La cartera sigue dentro del margen de 5 puntos porcentuales. Mantengo las posiciones y el efectivo.", { model: c.model }); return; }
  }
  // Validate the complete rebalance before changing anything. A failed leg keeps the original portfolio.
  const draft = structuredClone(c);
  for (const pos of [...draft.portfolios[agent].positions]) {
    const q = draft.quotes.find((a) => a.symbol === pos.symbol);
    if (!q || !freshQuote(q, now)) throw new Error("Falta una cotización reciente para revisar toda la cartera.");
    const target = targets.find((a) => a.symbol === pos.symbol)?.weight ?? 0;
    const excess = pos.quantity - total * target / q.price;
    if (excess * q.price > Math.max(5, total * 0.005)) trade(draft, agent, pos.symbol, "sell", target === 0 ? pos.quantity : Math.floor(excess * 1e6) / 1e6, p.reason, now);
  }
  for (const a of targets) {
    const q = draft.quotes.find((q) => q.symbol === a.symbol);
    if (!q || !freshQuote(q, now)) throw new Error("Falta una cotización reciente para comprar.");
    const pos = draft.portfolios[agent].positions.find((p) => p.symbol === a.symbol);
    const deficit = total * a.weight - (pos?.quantity ?? 0) * q.price;
    const cashFloor = agent === "patient" ? total * 0.2 : 0;
    const budget = Math.min(deficit, draft.portfolios[agent].cash.USD - cashFloor);
    if (budget > Math.max(5, total * 0.005)) {
      const qty = buyWithinBudget(draft.portfolios[agent], a.symbol, budget, q, c.commission);
      if (qty > 0) trade(draft, agent, a.symbol, "buy", qty, p.reason, now);
    }
  }
  if (draft.decisions.length === c.decisions.length) logDecision(draft, agent, "hold", p.reason, { model: c.model });
  c.portfolios[agent] = draft.portfolios[agent];
  c.decisions = draft.decisions;
  if (agent === "patient" && !c.patientTargets && targets.length) c.patientTargets = targets;
}
export function snapshot(c: Competition, now = new Date()) {
  const values = Object.fromEntries(PARTICIPANTS.map((p) => [p, value(c.portfolios[p], c.quotes)])) as Record<ParticipantId, number>;
  const point = { at: now.toISOString(), values };
  const last = c.snapshots.at(-1);
  if (last && c.snapshots.length > 1 && point.at.slice(0, 10) === last.at.slice(0, 10)) c.snapshots[c.snapshots.length - 1] = point;
  else c.snapshots.push(point);
}
export function maxDrawdown(c: Competition, id: ParticipantId) {
  let peak = c.initialCapital; let worst = 0;
  for (const point of c.snapshots) { peak = Math.max(peak, point.values[id]); worst = Math.min(worst, point.values[id] / peak - 1); }
  return worst * 100;
}
