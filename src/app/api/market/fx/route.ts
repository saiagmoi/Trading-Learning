import { getMarketDataProvider } from "@/lib/market/factory";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const provider = getMarketDataProvider();
    const fx = await provider.getFxRate();
    return NextResponse.json({ fx, demo: provider.id === "demo" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No hay tipo de cambio." },
      { status: 502 },
    );
  }
}
