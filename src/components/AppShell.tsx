"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Onboarding } from "@/components/Onboarding";
import { QuoteFeed } from "@/components/QuoteFeed";
import { SearchBar } from "@/components/SearchBar";
import { fetchStatus } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useHydrated } from "@/hooks/useHydrated";
import { useSimulation } from "@/store/simulation-store";

const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/mercados", label: "Mercados" },
  { href: "/cartera", label: "Mi cartera" },
  { href: "/historial", label: "Historial" },
  { href: "/simulador", label: "¿Qué habría pasado si...?" },
  { href: "/dca", label: "Inversión mensual" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/aprender", label: "Aprender" },
  { href: "/desafios", label: "Desafíos" },
  { href: "/configuracion", label: "Configuración" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const onboarded = useSimulation((s) => s.onboarded);
  const cash = useSimulation((s) => s.portfolio.cash);
  const display = useSimulation((s) => s.profile?.displayCurrency ?? "USD");
  const error = useSimulation((s) => s.error);
  const pathname = usePathname();
  const [open, setOpen] = useState<{ us: boolean; ar: boolean } | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    fetchStatus()
      .then((s) => setOpen({ us: s.us.isOpen, ar: s.ar.isOpen }))
      .catch(() => setOpen(null));
  }, []);

  return (
    <div className="min-h-full">
      <QuoteFeed />
      {hydrated && !onboarded && <Onboarding />}
      <div className="sim-banner px-4 py-2 text-center text-xs md:text-sm">
        SIMULACIÓN · No se opera dinero real · No es asesoramiento financiero · Una ganancia pasada
        no garantiza ganancias futuras
      </div>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <button className="md:hidden" onClick={() => setMenu((m) => !m)} aria-label="Menú">
            ☰
          </button>
          <Link href="/" className="shrink-0 font-semibold tracking-tight">
            Aula Inversora
          </Link>
          <div className="hidden flex-1 md:block">
            <SearchBar />
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="hidden sm:inline">
              {open?.us ? "🟢" : "⚪"} EE.UU. {open?.us ? "Mercado abierto" : "Mercado cerrado"}
            </span>
            <span className="hidden sm:inline">
              {open?.ar ? "🟢" : "⚪"} ARG {open?.ar ? "Mercado abierto" : "Mercado cerrado"}
            </span>
            <span className="num rounded-lg border border-line px-2 py-1">
              {formatMoney(display === "ARS" ? cash.ARS : cash.USD, display)}
            </span>
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <SearchBar />
        </div>
        <nav className="mx-auto hidden max-w-7xl gap-1 overflow-x-auto px-4 pb-2 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${
                pathname === n.href ? "bg-panel text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      {menu && (
        <div className="border-b border-line bg-panel px-4 py-2 md:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setMenu(false)}
              className="block py-2 text-sm"
            >
              {n.label}
            </Link>
          ))}
        </div>
      )}
      {error && (
        <div className="mx-auto max-w-7xl px-4 pt-3">
          <p className="rounded-xl border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
            {error}
          </p>
        </div>
      )}
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
