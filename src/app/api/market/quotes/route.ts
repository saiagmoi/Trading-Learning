import { getMarketDataProvider } from "@/lib/market/factory";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbols =
    req.nextUrl.searchParams.get("symbols")?.split(",").map((s) => s.trim()).filter(Boolean) ??
    [];
  try {
    const provider = getMarketDataProvider();
    const result = await provider.getQuotes(symbols);
    return NextResponse.json({
      ...result,
      provider: provider.id,
      demo: provider.id === "demo",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudieron obtener cotizaciones." },
      { status: 502 },
    );
  }
}
