import { NextRequest, NextResponse } from "next/server";
import { getMarketDataProvider } from "@/lib/market/factory";
import { getMarketHours } from "@/lib/market/hours";
import { createCompetition, freshQuote, logDecision, snapshot, trade } from "@/lib/competition/engine";
import { nextTradingEvaluation } from "@/lib/competition/schedule";
import { connection, refresh, review, universe, view } from "@/lib/competition/service";
import { exclusive, readCompetition, writeCompetition } from "@/lib/competition/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest, mutation = false) {
  const hostname = req.nextUrl.hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) return false;
  const token = process.env.COMPETITION_ACCESS_TOKEN;
  if (token && req.headers.get("authorization") === `Bearer ${token}`) return true;
  const origin = req.headers.get("origin");
  if (!origin) return !mutation;
  try {
    const source = new URL(origin);
    // Next's dev URL can normalize 127.0.0.1 to localhost; use the incoming Host.
    const sameOrigin = source.host === req.headers.get("host") && source.protocol === req.nextUrl.protocol;
    return sameOrigin && ["localhost", "127.0.0.1", "[::1]"].includes(source.hostname);
  } catch { return false; }
}
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "La competencia está disponible únicamente desde este equipo." }, { status: 403 });
  try { return NextResponse.json(view(await readCompetition())); }
  catch { return NextResponse.json({ error: "No se pudo leer la competencia guardada. Revisá el archivo del servidor antes de continuar." }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  if (!authorized(req, true)) return NextResponse.json({ error: "Solicitud no autorizada. Abrí Competencia desde la aplicación local." }, { status: 403 });
  try {
    if (Number(req.headers.get("content-length")) > 10_000) throw new Error("Solicitud demasiado grande.");
    const input = await req.json();
    return await exclusive(async () => {
      let c = await readCompetition();
      if (input.action === "start") {
        if (c) throw new Error("Ya existe una ronda. Sus resultados se conservan y no se reemplazan.");
        if (!connection().ready) throw new Error("Falta conectar la IA: configurá OPENAI_API_KEY y OPENAI_MODEL en .env.local y reiniciá la aplicación.");
        if (getMarketDataProvider().id !== "yahoo") throw new Error("La ronda oficial requiere datos Yahoo. El modo demo no se mezcla con la competencia.");
        c = createCompetition(input.capital, process.env.OPENAI_MODEL!, "yahoo");
        c.scheduledFor = nextTradingEvaluation().toISOString();
        c.endsAt = new Date(new Date(c.scheduledFor).getTime() + 42 * 86_400_000).toISOString();
        c.notice = "Ronda programada. Todos conservan su efectivo hasta la próxima rueda a las 12:00 de Argentina. Los agentes pueden decidir esperar.";
        snapshot(c);
        c.lastCheckedAt = new Date(0).toISOString();
        await writeCompetition(c);
        return NextResponse.json(view(c));
      }
      if (!c) throw new Error("Primero iniciá la ronda.");
      if (input.action === "review") return NextResponse.json(view(await review(c)));
      if (input.action === "pause" || input.action === "resume") {
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
          if (c.scheduledFor && Date.now() < new Date(c.scheduledFor).getTime()) throw new Error("La ronda está programada: las operaciones se habilitan en la fecha inicial a las 12:00 de Argentina.");
          if (!getMarketHours("US").isOpen) throw new Error("Mercado cerrado. Podés esperar y operar en la próxima rueda.");
          if (!["buy", "sell"].includes(input.side) || !universe().some((a) => a.symbol === input.symbol)) throw new Error("Elegí una operación y un activo del catálogo de EE.UU.");
          await refresh(c);
          const q = c.quotes.find((q) => q.symbol === input.symbol);
          if (!q || !freshQuote(q)) throw new Error("Sin cotización reciente para ese activo.");
          trade(c, "you", input.symbol, input.side, input.quantity, reason);
          snapshot(c);
        }
      } else throw new Error("Acción desconocida.");
      await writeCompetition(c);
      return NextResponse.json(view(c));
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo completar la operación." }, { status: 400 });
  }
}
