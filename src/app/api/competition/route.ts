import { NextRequest, NextResponse } from "next/server";
import { getMarketDataProvider } from "@/lib/market/factory";
import { getMarketHours } from "@/lib/market/hours";
import { cancelOrder, placeWorkingOrder } from "@/lib/simulation/engine";
import { createCompetition, freshQuote, logDecision, snapshot, trade } from "@/lib/competition/engine";
import { nextTradingEvaluation } from "@/lib/competition/schedule";
import { connection, refresh, review, universe, view, matchCompetitionPending } from "@/lib/competition/service";
import { canMutate, hasOwnerAccess, isLocalRequest } from "@/lib/competition/access";
import { exclusive, readCompetition, writeCompetition, storageStatus } from "@/lib/competition/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function responseView(req: NextRequest, competition: Parameters<typeof view>[0]) {
  const storage = storageStatus();
  return { ...view(competition), setup: {
    hosted: storage.hosted, storageReady: storage.ready,
    accessConfigured: isLocalRequest(req) || Boolean(process.env.COMPETITION_ACCESS_TOKEN),
    authorized: hasOwnerAccess(req), cronConfigured: Boolean(process.env.CRON_SECRET),
  } };
}
export async function GET(req: NextRequest) {
  const owner = hasOwnerAccess(req);
  if (!owner && req.headers.has("x-competition-token")) return NextResponse.json({ error: "La clave de acceso a la competencia no es correcta." }, { status: 401 });
  try {
    // Public readiness information never exposes portfolios, inputs or credentials.
    const c = owner && storageStatus().ready ? await readCompetition() : null;
    return NextResponse.json(responseView(req, c), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "No se pudo leer la competencia. Revisá la conexión del almacenamiento privado de Vercel." }, { status: 503 });
  }
}
export async function POST(req: NextRequest) {
  if (!canMutate(req)) return NextResponse.json({ error: "Ingresá la clave privada de acceso a la competencia para continuar." }, { status: 403 });
  try {
    if (Number(req.headers.get("content-length")) > 10_000) throw new Error("Solicitud demasiado grande.");
    const input = await req.json();
    return await exclusive(async () => {
      let c = await readCompetition();
      if (input.action === "start") {
        if (storageStatus().hosted && !process.env.CRON_SECRET) throw new Error("Configurá CRON_SECRET en Vercel y volvé a desplegar para habilitar las evaluaciones diarias.");
        if (c) throw new Error("Ya existe una ronda. Sus resultados se conservan y no se reemplazan.");
        if (!connection().ready) throw new Error("Falta conectar la IA: configurá OPENAI_API_KEY y OPENAI_MODEL en las variables de entorno del servidor y volvé a desplegar.");
        if (getMarketDataProvider().id !== "yahoo") throw new Error("La ronda oficial requiere datos Yahoo. El modo demo no se mezcla con la competencia.");
        c = createCompetition(input.capital, process.env.OPENAI_MODEL!, "yahoo");
        c.scheduledFor = nextTradingEvaluation().toISOString();
        c.endsAt = new Date(new Date(c.scheduledFor).getTime() + 42 * 86_400_000).toISOString();
        c.notice = "Ronda programada. Todos conservan su efectivo hasta la próxima rueda a las 12:00 de Argentina. Los agentes pueden decidir esperar.";
        snapshot(c);
        c.lastCheckedAt = new Date(0).toISOString();
        await writeCompetition(c);
        return NextResponse.json(responseView(req, c));
      }
      if (!c) throw new Error("Primero iniciá la ronda.");
      if (input.action === "review") return NextResponse.json(responseView(req, await review(c)));
      if (input.action === "cancel") {
        const pending = c.portfolios.you.orders.find((o) => o.id === input.orderId && o.status === "pending");
        if (!pending) throw new Error("La orden ya no está pendiente.");
        c.portfolios.you = cancelOrder(c.portfolios.you, pending.id);
        logDecision(c, "you", "hold", `Cancelé la orden límite de ${pending.symbol}. Se liberó el saldo o las unidades reservadas.`);
      } else if (input.action === "pause" || input.action === "resume") {
        if (c.status === "finished") throw new Error("La ronda ya terminó.");
        c.status = input.action === "pause" ? "paused" : "active";
        c.notice = input.action === "pause" ? "Ronda pausada: no se ejecutan operaciones. El plazo de 6 semanas sigue corriendo." : "Ronda reanudada. Se evaluará en la próxima actualización con mercado abierto.";
        logDecision(c, "you", "hold", c.notice);
      } else if (input.action === "trade" || input.action === "hold") {
        if (c.status !== "active" || Date.now() >= new Date(c.endsAt).getTime()) throw new Error("La ronda no está activa.");
        const reason = typeof input.reason === "string" ? input.reason.trim() : "";
        if (!reason || reason.length > 1000) throw new Error("Escribí tu motivo, con un máximo de 1.000 caracteres.");
        if (input.action === "hold") logDecision(c, "you", "hold", reason);
        else {

          if (!["buy", "sell"].includes(input.side) || !universe().some((a) => a.symbol === input.symbol)) throw new Error("Elegí una operación y un activo del catálogo de EE.UU.");
          const orderType = input.orderType ?? "market";
          if (!["market", "limit"].includes(orderType)) throw new Error("Elegí orden de mercado o límite.");
          if (orderType === "limit") {
            c.portfolios.you = placeWorkingOrder(c.portfolios.you, { symbol: input.symbol, side: input.side, type: "limit", quantity: input.quantity, limitPrice: input.limitPrice }, c.commission);
            logDecision(c, "you", "review", `Envié una orden límite GTC de ${input.side === "buy" ? "compra" : "venta"} de ${input.quantity} ${input.symbol} a USD ${input.limitPrice}. ${reason}`);
            if (getMarketHours("US").isOpen && (!c.scheduledFor || Date.now() >= new Date(c.scheduledFor).getTime())) {
              try { await refresh(c); matchCompetitionPending(c); snapshot(c); }
              catch { c.notice = "Orden límite guardada. Espera una cotización válida de la rueda regular para evaluar su ejecución."; }
            }
          } else {
            if (c.scheduledFor && Date.now() < new Date(c.scheduledFor).getTime()) throw new Error("La ronda está programada: las operaciones se habilitan en la fecha inicial a las 12:00 de Argentina.");
            if (!getMarketHours("US").isOpen) throw new Error("Mercado cerrado: las órdenes de mercado no se ejecutan. Podés enviar una orden límite pendiente.");
            await refresh(c);
            const q = c.quotes.find((q) => q.symbol === input.symbol);
            if (!q || !freshQuote(q)) throw new Error("Sin cotización reciente para ese activo.");
            trade(c, "you", input.symbol, input.side, input.quantity, reason);
            snapshot(c);
          }
        }
      } else throw new Error("Acción desconocida.");
      await writeCompetition(c);
      return NextResponse.json(responseView(req, c));
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo completar la operación." }, { status: 400 });
  }
}
