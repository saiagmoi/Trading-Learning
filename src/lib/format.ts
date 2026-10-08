import type { Currency } from "@/lib/types";


const arNumberCompact = new Intl.NumberFormat("es-AR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const arInteger = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

const arDateTime = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "America/Argentina/Buenos_Aires",
});

const arDate = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function formatMoney(value: number, currency: Currency): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : "";
  const formatted = value.toLocaleString("es-AR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${sign}${formatted}%`;
}

export function formatVolume(value: number | null | undefined): string {
  if (value == null) return "—";
  if (Math.abs(value) >= 1_000_000) return arNumberCompact.format(value);
  return arInteger.format(value);
}

export function formatDateTime(iso: string | number | Date): string {
  return arDateTime.format(new Date(iso));
}

export function formatDate(iso: string | number | Date): string {
  return arDate.format(new Date(iso));
}

export function pnlClass(value: number): string {
  if (value > 0.0000001) return "text-gain";
  if (value < -0.0000001) return "text-loss";
  return "text-muted";
}

export function signedMoney(value: number, currency: Currency): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatMoney(value, currency)}`;
}
