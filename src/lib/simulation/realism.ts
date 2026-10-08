import type { CommissionConfig, Currency, Market, RealismLevel } from "@/lib/types";

export const REALISM_PRESETS: Record<RealismLevel, CommissionConfig> = {
  beginner: {
    usPercent: 0,
    usMin: 0,
    arPercent: 0,
    arMin: 0,
    spreadBps: 0,
    slippageBps: 0,
  },
  realistic: {
    usPercent: 0.1,
    usMin: 1,
    arPercent: 0.5,
    arMin: 500,
    spreadBps: 5,
    slippageBps: 2,
  },
  advanced: {
    usPercent: 0.15,
    usMin: 1,
    arPercent: 0.8,
    arMin: 800,
    spreadBps: 10,
    slippageBps: 5,
  },
};

export interface ExecutionQuote {
  fillPrice: number;
  commission: number;
  spread: number;
  slippage: number;
  gross: number;
  total: number;
}

export function applyExecution(
  lastPrice: number,
  quantity: number,
  side: "buy" | "sell",
  currency: Currency,
  market: Market,
  config: CommissionConfig,
): ExecutionQuote {
  const spread = lastPrice * (config.spreadBps / 10_000);
  const slip = lastPrice * (config.slippageBps / 10_000);
  const dir = side === "buy" ? 1 : -1;
  const fillPrice = lastPrice + dir * (spread / 2 + slip);
  const gross = fillPrice * quantity;
  const pct = market === "AR" ? config.arPercent : config.usPercent;
  const min = market === "AR" ? config.arMin : config.usMin;
  const commission = Math.max(min, (gross * pct) / 100);
  const total = side === "buy" ? gross + commission : gross - commission;
  return { fillPrice, commission, spread, slippage: slip, gross, total };
}

export function realismHint(level: RealismLevel): string {
  if (level === "beginner") {
    return "Nivel principiante: sin comisiones ni slippage. El precio de ejecución coincide con la última cotización disponible.";
  }
  if (level === "realistic") {
    return "Nivel realista: comisión, spread y slippage simulados. No coinciden necesariamente con un broker real.";
  }
  return "Nivel avanzado: costos simulados más exigentes. Siguen siendo ficticios y educativos.";
}
