"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchSearch } from "@/lib/api";
import { registerAsset } from "@/lib/assets";
import type { SearchHit } from "@/lib/types";

const GROUPS: { key: string; label: string; test: (h: SearchHit) => boolean }[] = [
  { key: "stock", label: "Acciones", test: (h) => h.asset.type === "stock" },
  { key: "etf", label: "ETFs", test: (h) => h.asset.type === "etf" },
  { key: "index", label: "Índices", test: (h) => h.asset.type === "index" },
  { key: "us", label: "Estados Unidos", test: (h) => h.asset.market === "US" },
  { key: "ar", label: "Argentina", test: (h) => h.asset.market === "AR" },
];

export function SearchBar() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 1) return;
    const t = setTimeout(() => {
      fetchSearch(trimmed)
        .then((r) => setHits(r.hits))
        .catch(() => setHits([]));
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const activeHits = useMemo(() => (q.trim().length < 1 ? [] : hits), [q, hits]);

  const grouped = useMemo(() => {
    return GROUPS.map((g) => ({ ...g, items: activeHits.filter(g.test) })).filter(
      (g) => g.items.length > 0,
    );
  }, [activeHits]);

  return (
    <div className="relative w-full max-w-xl">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder="Buscar Apple, AAPL, GGAL..."
        className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
      />
      {open && q && (
        <div className="absolute z-40 mt-2 max-h-96 w-full overflow-auto rounded-xl border border-line bg-panel p-2 shadow-2xl">
          {activeHits.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted">Sin resultados.</p>
          )}
          {grouped.map((g) => (
            <div key={g.key} className="mb-2">
              <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted">{g.label}</p>
              {g.items.slice(0, 6).map((h) => (
                <button
                  key={`${g.key}-${h.asset.symbol}`}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-bg"
                  onMouseDown={() => {
                    registerAsset(h.asset);
                    router.push(`/activo/${encodeURIComponent(h.asset.symbol)}`);
                    setQ("");
                    setOpen(false);
                  }}
                >
                  <span className="num font-semibold">{h.asset.symbol}</span>
                  <span className="truncate pl-3 text-muted">{h.asset.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
