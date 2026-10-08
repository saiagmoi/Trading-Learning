import { getCatalogAssets, getIndices } from "@/lib/assets";
import { getMarketDataProvider } from "@/lib/market/factory";
import type { SearchHit } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ hits: [], demo: false });
  const local = [...getCatalogAssets(), ...getIndices()]
    .filter(
      (a) =>
        a.symbol.toLowerCase().includes(q.toLowerCase()) ||
        a.name.toLowerCase().includes(q.toLowerCase()),
    )
    .map((asset) => ({ asset, score: 2 })) satisfies SearchHit[];
  try {
    const provider = getMarketDataProvider();
    const remote = await provider.search(q);
    const seen = new Set(local.map((h) => h.asset.symbol.toUpperCase()));
    const merged = [...local];
    for (const hit of remote) {
      if (!seen.has(hit.asset.symbol.toUpperCase())) {
        merged.push(hit);
        seen.add(hit.asset.symbol.toUpperCase());
      }
    }
    return NextResponse.json({ hits: merged.slice(0, 20), demo: provider.id === "demo" });
  } catch {
    return NextResponse.json({ hits: local, demo: false });
  }
}
