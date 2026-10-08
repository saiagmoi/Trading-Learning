import type { Portfolio, Price } from "@/lib/types";
import { findAsset } from "@/lib/assets";

export interface ChallengeDef {
  id: string;
  title: string;
  description: string;
  xp: number;
  badge: string;
  check: (p: Portfolio, quotes: Price[]) => { ok: boolean; hint: string };
}

const DAY = 24 * 60 * 60 * 1000;

export const CHALLENGES: ChallengeDef[] = [
  {
    id: "hold30",
    title: "Desafío 1 · Mantener 30 días",
    description: "Invertí al menos USD 1.000 (o el equivalente) y mantené una posición abierta durante 30 días.",
    xp: 50,
    badge: "Paciencia",
    check: (p) => {
      const old = p.positions.find((pos) => Date.now() - new Date(pos.openedAt).getTime() >= 30 * DAY);
      const spent = p.trades.filter((t) => t.side === "buy").reduce((a, t) => a + (t.currency === "USD" ? t.total : 0), 0);
      return {
        ok: Boolean(old) && spent >= 1000,
        hint: "Comprá y esperá. El reloj usa la fecha real de tu compra simulada.",
      };
    },
  },
  {
    id: "diversify",
    title: "Desafío 2 · Cartera diversificada",
    description: "Tené al menos 4 activos distintos, incluyendo EE.UU. y Argentina.",
    xp: 60,
    badge: "Diversificador",
    check: (p) => {
      const markets = new Set(p.positions.map((pos) => findAsset(pos.symbol)?.market));
      return {
        ok: p.positions.length >= 4 && markets.has("US") && markets.has("AR"),
        hint: "Combiná acciones o ETFs de EE.UU. con papeles argentinos.",
      };
    },
  },
  {
    id: "vs-spy",
    title: "Desafío 3 · Comparar contra el S&P 500",
    description: "Usá el simulador histórico para comparar un activo contra SPY o el S&P 500.",
    xp: 40,
    badge: "Comparador",
    check: (p) => ({
      ok: p.badges.includes("Comparador") || p.challenges.some((c) => c.id === "vs-spy" && c.status === "completed"),
      hint: "Completá una comparación en ¿Qué habría pasado si...?",
    }),
  },
  {
    id: "limit",
    title: "Desafío 4 · Orden límite",
    description: "Creá una orden límite (compra o venta) y dejala pendiente o ejecutada.",
    xp: 40,
    badge: "Estratega",
    check: (p) => ({
      ok: p.orders.some((o) => o.type === "limit"),
      hint: "En la ficha de un activo, elegí orden límite y confirmá.",
    }),
  },
  {
    id: "etf-only",
    title: "Desafío 5 · Solo ETFs",
    description: "Armá una cartera con al menos 2 posiciones y que todas sean ETFs.",
    xp: 50,
    badge: "Indexado",
    check: (p) => {
      if (p.positions.length < 2) return { ok: false, hint: "Necesitás al menos dos ETFs." };
      const allEtf = p.positions.every((pos) => findAsset(pos.symbol)?.type === "etf");
      return { ok: allEtf, hint: "Vendé las acciones individuales o usá SPY, QQQ, DIA, IWM." };
    },
  },
];
