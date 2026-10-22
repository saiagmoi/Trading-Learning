import { getCatalogAssets } from "@/lib/assets";
import { getMarketDataProvider } from "@/lib/market/factory";
import { getMarketHours } from "@/lib/market/hours";
import { askAgent, type AgentEvidence } from "./agent";
import { applyProposal, buyWithinBudget, freshQuote, logDecision, snapshot, trade } from "./engine";
import { argentinaDay, dailyWindowOpen } from "./schedule";
import { writeCompetition } from "./storage";
import { AGENT_IDS, type Competition, type CompetitionView } from "./types";

export function connection() {
  return { ready: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL), keyConfigured: Boolean(process.env.OPENAI_API_KEY), modelConfigured: Boolean(process.env.OPENAI_MODEL), model: process.env.OPENAI_MODEL || null };
}
export function view(competition: Competition | null): CompetitionView {
  return { competition, connection: connection(), marketOpen: getMarketHours("US").isOpen, now: new Date().toISOString() };
}
export function universe() {
  return getCatalogAssets().filter((a) => a.currency === "USD" && a.market === "US" && a.type !== "index");
}
export async function refresh(c: Competition) {
  const provider = getMarketDataProvider();
  if (provider.id !== c.provider) throw new Error("El proveedor cambió desde el inicio. Volvé al proveedor original para conservar la comparación.");
  const result = await provider.getQuotes(universe().map((a) => a.symbol));
  if (result.quotes.some((q) => q.provider !== c.provider)) throw new Error("Las fuentes de datos no coinciden.");
  // A partial batch is never combined with older prices for trading or ranking.
  const now = Date.now();
  const required = new Set(["SPY", ...Object.values(c.portfolios).flatMap((p) => p.positions.map((p) => p.symbol))]);
  for (const symbol of required) {
    const q = result.quotes.find((q) => q.symbol === symbol);
    if (!q || !freshQuote(q, now)) throw new Error("Faltan cotizaciones recientes para valorar todas las carteras. No se ejecutaron operaciones.");
  }
  c.quotes = result.quotes.filter((q) => freshQuote(q, now));
}
async function evidence(c: Competition): Promise<AgentEvidence> {
  const provider = getMarketDataProvider();
  const histories: AgentEvidence["histories"] = {};
  const news: AgentEvidence["news"] = {};
  await Promise.all(c.quotes.map(async (q) => {
    try {
      const h = await provider.getHistory(q.symbol, "6m");
      // Exclude today's unfinished daily bar and any future observation.
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
      histories[q.symbol] = h.bars.filter((b) => new Date(b.time * 1000).toISOString().slice(0, 10) < today && Number.isFinite(b.close) && b.close > 0);
    } catch { /* Missing history means no momentum candidate. */ }
    if (universe().find((a) => a.symbol === q.symbol)?.type === "stock") {
      try { news[q.symbol] = (await provider.getNews(q.symbol)).items.filter((n) => new Date(n.publishedAt).getTime() <= Date.now()).slice(0, 3); }
      catch { /* Missing news is explicitly missing evidence. */ }
    }
  }));
  return { observedAt: new Date().toISOString(), quotes: c.quotes, histories, news };
}
export async function review(c: Competition, now = new Date()) {
  if (c.status !== "active") return c;
  if (now.getTime() >= new Date(c.endsAt).getTime()) {
    c.status = "finished";
    c.notice = "Ronda terminada. El resultado usa la última valuación guardada antes del fin; consultá su fecha. No se reconstruyen operaciones ni precios de períodos sin conexión.";
    await writeCompetition(c); return c;
  }
  if ((c.scheduledFor && now.getTime() < new Date(c.scheduledFor).getTime()) || !dailyWindowOpen(now)) {
    c.notice = "Esperando el inicio programado o la evaluación de las 12:00 de Argentina. Nadie está obligado a operar.";
    await writeCompetition(c); return c;
  }
  if (Date.now() - new Date(c.lastCheckedAt).getTime() < 55_000 && c.snapshots.length) return c;
  c.lastCheckedAt = new Date().toISOString();
  if (!getMarketHours("US", now).isOpen) {
    c.notice = "Mercado cerrado: todos esperan. Se conserva la última valuación y no se inventan precios.";
    await writeCompetition(c); return c;
  }
  if (!connection().ready || process.env.OPENAI_MODEL !== c.model) {
    c.notice = "La conexión de IA falta o cambió el modelo. Se conserva la cartera; restaurá la configuración de inicio.";
    await writeCompetition(c); return c;
  }
  await refresh(c);
  if (!c.portfolios.spy.trades.length) {
    const quote = c.quotes.find((q) => q.symbol === "SPY")!;
    const qty = buyWithinBudget(c.portfolios.spy, "SPY", c.initialCapital, quote, c.commission);
    trade(c, "spy", "SPY", "buy", qty, "Referencia: compro SPY una vez y mantengo durante toda la ronda.");
  }
  const due = AGENT_IDS.filter((id) => {
    const last = c.lastReview[id];
    const attempt = c.lastAttempt[id];
    return (!last || argentinaDay(last) !== argentinaDay(now)) && (!attempt || argentinaDay(attempt) !== argentinaDay(now));
  });
  if (due.length) {
    const data = await evidence(c);
    for (const id of due) {
      // Save the attempt before a paid request. Restarting cannot trigger duplicate calls.
      c.lastAttempt[id] = now.toISOString();
      await writeCompetition(c);
      try {
        const answer = await askAgent(id, c, data);
        // Persist the exact input and proposed allocation alongside the immutable diary.
        const draft = structuredClone(c);
        applyProposal(draft, id, answer.proposal);
        if (Date.now() >= new Date(c.endsAt).getTime() || !getMarketHours("US").isOpen) throw new Error("Terminó la ventana de operación durante el análisis. Se conserva la cartera.");
        c.portfolios[id] = draft.portfolios[id];
        c.patientTargets = draft.patientTargets;
        c.decisions = draft.decisions;
        logDecision(c, id, "review", `Evaluación diaria: ${answer.proposal.reason}`, { model: c.model, evidence: { input: answer.evidence, proposal: answer.proposal } });
        c.lastReview[id] = now.toISOString();
      } catch (error) {
        logDecision(c, id, "error", error instanceof Error ? error.message : "No se pudo evaluar. Se conserva la cartera.", { model: c.model });
      }
      await writeCompetition(c);
    }
  }
  snapshot(c);
  c.notice = "Carteras actualizadas. Los agentes se evalúan una vez por rueda desde las 12:00 de Argentina y pueden esperar. Los errores se reintentan en la próxima rueda.";
  await writeCompetition(c);
  return c;
}
