import type { Market } from "@/lib/types";

const US_HOLIDAYS = new Set([
  "2025-01-01",
  "2025-01-20",
  "2025-02-17",
  "2025-04-18",
  "2025-05-26",
  "2025-06-19",
  "2025-07-04",
  "2025-09-01",
  "2025-11-27",
  "2025-12-25",
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
]);

const AR_HOLIDAYS = new Set([
  "2025-01-01",
  "2025-03-03",
  "2025-03-04",
  "2025-03-24",
  "2025-04-02",
  "2025-04-18",
  "2025-05-01",
  "2025-05-25",
  "2025-06-16",
  "2025-06-20",
  "2025-07-09",
  "2025-08-18",
  "2025-10-13",
  "2025-11-24",
  "2025-12-08",
  "2025-12-25",
  "2026-01-01",
  "2026-02-16",
  "2026-02-17",
  "2026-03-24",
  "2026-04-02",
  "2026-04-03",
  "2026-05-01",
  "2026-05-25",
  "2026-06-15",
  "2026-06-20",
  "2026-07-09",
  "2026-08-17",
  "2026-10-12",
  "2026-11-23",
  "2026-12-08",
  "2026-12-25",
]);

function ymdInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function hmInZone(date: Date, timeZone: string): { h: number; m: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    h: Number(map.hour),
    m: Number(map.minute),
    weekday: weekdayMap[map.weekday] ?? 0,
  };
}

export interface MarketHoursStatus {
  market: Market;
  isOpen: boolean;
  label: string;
  timeZone: string;
  nextHint: string;
}

export function getMarketHours(market: Market, now = new Date()): MarketHoursStatus {
  if (market === "US") {
    const tz = "America/New_York";
    const day = ymdInZone(now, tz);
    const { h, m, weekday } = hmInZone(now, tz);
    const minutes = h * 60 + m;
    const holiday = US_HOLIDAYS.has(day);
    const weekdayOk = weekday >= 1 && weekday <= 5;
    const session = minutes >= 9 * 60 + 30 && minutes < 16 * 60;
    const isOpen = weekdayOk && !holiday && session;
    return {
      market,
      isOpen,
      label: isOpen ? "Mercado abierto" : "Mercado cerrado",
      timeZone: tz,
      nextHint: "NYSE / Nasdaq · 9:30–16:00 (hora de Nueva York), días hábiles.",
    };
  }
  const tz = "America/Argentina/Buenos_Aires";
  const day = ymdInZone(now, tz);
  const { h, m, weekday } = hmInZone(now, tz);
  const minutes = h * 60 + m;
  const holiday = AR_HOLIDAYS.has(day);
  const weekdayOk = weekday >= 1 && weekday <= 5;
  const session = minutes >= 11 * 60 && minutes < 17 * 60;
  const isOpen = weekdayOk && !holiday && session;
  return {
    market,
    isOpen,
    label: isOpen ? "Mercado abierto" : "Mercado cerrado",
    timeZone: tz,
    nextHint: "BYMA · 11:00–17:00 (hora de Buenos Aires), días hábiles. Horario aproximado.",
  };
}
