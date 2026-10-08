import { getMarketDataProvider } from "@/lib/market/factory";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "";
  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? new Date().toISOString();
  if (!symbol || !from) {
    return NextResponse.json({ error: "Faltan parámetros." }, { status: 400 });
  }
  try {
    const provider = getMarketDataProvider();
    const result = await provider.getHistoryBetween(symbol, from, to);
    return NextResponse.json({ ...result, demo: provider.id === "demo" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo obtener el histórico." },
      { status: 502 },
    );
  }
}
