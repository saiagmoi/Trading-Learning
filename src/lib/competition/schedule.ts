import { getMarketHours } from "@/lib/market/hours";

export const COMPETITION_TIME_ZONE = "America/Argentina/Buenos_Aires";
export const REVIEW_HOUR = 12;
export function argentinaDay(date: Date | string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: COMPETITION_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
}
export function dailyWindowOpen(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: COMPETITION_TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(now));
  return hour >= REVIEW_HOUR;
}
// The first evaluation is always on a later trading day, at noon in Argentina.
// The existing market calendar accounts for weekends and known exchange holidays.
export function nextTradingEvaluation(now = new Date()) {
  const start = new Date(`${argentinaDay(now)}T12:00:00-03:00`);
  for (let days = 1; days <= 14; days++) {
    const candidate = new Date(start.getTime() + days * 86_400_000);
    if (getMarketHours("US", candidate).isOpen) return candidate;
  }
  throw new Error("No se encontró una próxima rueda en el calendario.");
}
