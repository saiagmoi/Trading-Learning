import { getCatalogAssets, getIndices } from "@/lib/assets";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    assets: getCatalogAssets(),
    indices: getIndices(),
  });
}
