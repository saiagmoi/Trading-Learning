import { NextRequest, NextResponse } from "next/server";
import { secretMatches } from "@/lib/competition/access";
import { exclusive, readCompetition } from "@/lib/competition/storage";
import { review } from "@/lib/competition/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secretMatches(req.headers.get("authorization"), secret ? `Bearer ${secret}` : undefined)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    return await exclusive(async () => {
      const c = await readCompetition();
      if (!c) return NextResponse.json({ ok: true, state: "not_started" });
      await review(c);
      return NextResponse.json({ ok: true, state: c.status, checkedAt: c.lastCheckedAt });
    });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar la competencia. Revisá los registros del servidor." }, { status: 503 });
  }
}
