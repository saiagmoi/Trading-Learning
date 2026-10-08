"use client";

import { formatDateTime } from "@/lib/format";
import type { DataFreshness } from "@/lib/types";

const LABELS: Record<DataFreshness, string> = {
  realtime: "Tiempo real",
  delayed: "Retrasado",
  historical: "Histórico",
  demo: "DATOS DE DEMOSTRACIÓN",
};

export function Freshness({
  freshness,
  lastUpdated,
  source,
}: {
  freshness: DataFreshness;
  lastUpdated: string;
  source?: string;
}) {
  const demo = freshness === "demo";
  return (
    <div className={`text-xs ${demo ? "text-demo" : "text-muted"}`}>
      <span className="rounded-md border border-line px-1.5 py-0.5">{LABELS[freshness]}</span>
      <span className="ml-2">Última actualización: {formatDateTime(lastUpdated)}</span>
      {source && <p className="mt-1">{source}</p>}
    </div>
  );
}
