import type { CommissionConfig, Portfolio, Price } from "@/lib/types";

export const AGENT_IDS = ["patient", "momentum", "analyst"] as const;
export type AgentId = typeof AGENT_IDS[number];
export type ParticipantId = AgentId | "you" | "spy";
export const NAMES: Record<ParticipantId, string> = {
  you: "Vos", spy: "S&P 500 · SPY", patient: "IA · Paciente", momentum: "IA · Tendencias", analyst: "IA · Analista",
};
export const STRATEGIES = {
  patient: {
    title: "Paciente", icon: "🌱", color: "#3dd68c", subtitle: "Diversificar y dar tiempo",
    description: "Elige ETFs del catálogo y mantiene una cartera estable. Reserva al menos 20 % en efectivo y limita cada ETF al 20 % del patrimonio.",
    wait: "Espera si no hay una combinación convincente o si la cartera sigue alineada con su plan. Después de la primera inversión, solo rebalancea desvíos mayores a 5 puntos porcentuales.",
    instruction: "Elegí únicamente ETFs. Buscá diversificación, explicá los solapamientos. Máximo 80% invertido y 20% por ETF. Tu primera cartera define pesos objetivo permanentes; en revisiones posteriores mantenelos y solo rebalanceá si algún peso se desvía más de 5 puntos porcentuales. Podés esperar con todo en efectivo si no hay una selección justificable.",
  },
  momentum: {
    title: "Tendencias", icon: "📈", color: "#4c8dff", subtitle: "Seguir la fuerza de los precios",
    description: "Busca hasta cinco activos con mejor rendimiento de 12 semanas, siempre que el cierre esté por encima de su media de 50 ruedas. Máximo 20 % por activo.",
    wait: "Espera si no hay señales válidas. Puede mantener efectivo, conservar posiciones que siguen cumpliendo y vender las que pierden el filtro.",
    instruction: "Usá los candidatos de momentum provistos: hasta los cinco mejores retornos de 12 semanas, positivos y por encima de la SMA50. No compres otros. Máximo 20% por activo. Podés elegir menos candidatos o esperar. Si una posición perdió el filtro, proponé salir de ella. No inventes indicadores.",
  },
  analyst: {
    title: "Analista", icon: "🔎", color: "#c084fc", subtitle: "Invertir con una tesis escrita",
    description: "Elige hasta cinco acciones a partir de precios, P/E, tamaño, dividend yield y titulares disponibles. Escribe su tesis, riesgos y qué le haría cambiar de opinión.",
    wait: "Espera si la evidencia es insuficiente. No presume conocer balances, deuda o crecimiento que la fuente no haya entregado.",
    instruction: "Elegí solo acciones, hasta cinco y máximo 20% por empresa. Usá únicamente los datos provistos: cotización, P/E, capitalización, dividend yield e históricos y titulares si existen. No tenés balances completos: no inventes crecimiento, deuda ni cifras. Si falta evidencia, mantené o esperá en efectivo. En la razón registrá tesis, riesgo y condición que invalidaría la tesis. Considerá tu diario previo.",
  },
} as const;

export interface Decision {
  id: string;
  participant: ParticipantId;
  at: string;
  action: "buy" | "sell" | "hold" | "error" | "review";
  reason: string;
  symbol?: string;
  quantity?: number;
  price?: number;
  commission?: number;
  model?: string;
  evidence?: unknown;
}
export interface Allocation { symbol: string; weight: number }
export interface Proposal { action: "hold" | "allocate"; reason: string; allocations: Allocation[] }
export interface Competition {
  version: 1;
  id: string;
  startedAt: string;
  endsAt: string;
  scheduledFor?: string;
  status: "active" | "paused" | "finished";
  initialCapital: number;
  model: string;
  provider: "yahoo" | "demo";
  commission: CommissionConfig;
  portfolios: Record<ParticipantId, Portfolio>;
  quotes: Price[];
  decisions: Decision[];
  lastReview: Partial<Record<AgentId, string>>;
  lastAttempt: Partial<Record<AgentId, string>>;
  patientTargets: Allocation[] | null;
  snapshots: { at: string; values: Record<ParticipantId, number> }[];
  lastCheckedAt: string;
  notice: string;
}
export interface CompetitionView {
  competition: Competition | null;
  connection: { ready: boolean; keyConfigured: boolean; modelConfigured: boolean; model: string | null };
  marketOpen: boolean;
  now: string;
}
