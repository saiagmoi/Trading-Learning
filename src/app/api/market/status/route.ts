import { isLiveTradingEnabled, getMarketDataProvider } from "@/lib/market/factory";
import { getMarketHours } from "@/lib/market/hours";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const provider = getMarketDataProvider();
  return NextResponse.json({
    us: getMarketHours("US"),
    ar: getMarketHours("AR"),
    provider: provider.id,
    liveTrading: isLiveTradingEnabled(),
  });
}
