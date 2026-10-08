import { getMarketDataProvider } from "@/lib/market/factory";
import type { ChartRange } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RANGES: ChartRange[] = ["1d", "1w", "1m", "3m", "6m", "1y", "5y", "10y", "max"];

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "";
  const range = (req.nextUrl.searchParams.get("range") ?? "1y") as ChartRange;
  if (!symbol) {
    return NextResponse.json({ error: "Falta el símbolo." }, { status: 400 });
  }
  if (!RANGES.includes(range)) {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  }
  try {
    const provider = getMarketDataProvider();
    const result = await provider.getHistory(symbol, range);
    return NextResponse.json({ ...result, demo: provider.id === "demo" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo obtener el histórico." },
      { status: 502 },
    );
  }
}
