import catalog from "@/data/assets.json";
import type { Asset, AssetType, Currency, Market } from "@/lib/types";

type RawAsset = {
  id: string;
  symbol: string;
  yahooSymbol: string;
  name: string;
  type: AssetType;
  market: Market;
  currency: Currency;
  exchange: string;
};

const assets: Asset[] = (catalog.assets as RawAsset[]).map((a) => ({ ...a }));
const indices: Asset[] = (catalog.indices as RawAsset[]).map((a) => ({ ...a }));

const extraAssets = new Map<string, Asset>();

export function getCatalogAssets(): Asset[] {
  return assets;
}

export function getIndices(): Asset[] {
  return indices;
}

export function getAllKnownAssets(): Asset[] {
  return [...assets, ...indices, ...extraAssets.values()];
}

export function findAsset(symbol: string): Asset | undefined {
  const key = symbol.trim().toUpperCase();
  return getAllKnownAssets().find(
    (a) =>
      a.symbol.toUpperCase() === key ||
      a.id.toUpperCase() === key ||
      a.yahooSymbol.toUpperCase() === key,
  );
}

export function registerAsset(asset: Asset): Asset {
  const existing = findAsset(asset.symbol) ?? findAsset(asset.yahooSymbol);
  if (existing) return existing;
  extraAssets.set(asset.symbol.toUpperCase(), asset);
  return asset;
}

export function yahooSymbolFor(symbol: string): string {
  const asset = findAsset(symbol);
  return asset?.yahooSymbol ?? symbol;
}

export function displaySymbolForYahoo(yahooSymbol: string): string {
  const asset = getAllKnownAssets().find(
    (a) => a.yahooSymbol.toUpperCase() === yahooSymbol.toUpperCase(),
  );
  return asset?.symbol ?? yahooSymbol.replace(".BA", "").replace("-", ".");
}

export function assetFromYahooQuote(input: {
  symbol: string;
  shortName?: string | null;
  longName?: string | null;
  quoteType?: string | null;
  currency?: string | null;
  exchange?: string | null;
  market?: string | null;
}): Asset {
  const yahoo = input.symbol;
  const display = displaySymbolForYahoo(yahoo);
  const isAr =
    yahoo.endsWith(".BA") ||
    yahoo === "^MERV" ||
    (input.currency ?? "").toUpperCase() === "ARS";
  const qType = (input.quoteType ?? "").toUpperCase();
  const type: AssetType = qType.includes("ETF")
    ? "etf"
    : qType.includes("INDEX")
      ? "index"
      : "stock";
  return registerAsset({
    id: display,
    symbol: display,
    yahooSymbol: yahoo,
    name: input.longName || input.shortName || display,
    type,
    market: isAr ? "AR" : "US",
    currency: isAr ? "ARS" : "USD",
    exchange: input.exchange || (isAr ? "BYMA" : "US"),
  });
}

export const BENCHMARKS = catalog.benchmarks as {
  sp500: string;
  nasdaq: string;
  merval: string;
};
