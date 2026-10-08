import { getMarketDataProvider } from "@/lib/market/factory";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "";
  if (!symbol) return NextResponse.json({ items: [], available: false });
  try {
    const provider = getMarketDataProvider();
    const result = await provider.getNews(symbol);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ items: [], available: false });
  }
}
