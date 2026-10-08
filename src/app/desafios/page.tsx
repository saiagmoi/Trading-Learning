"use client";

import { CHALLENGES } from "@/lib/education/challenges";
import { useSimulation } from "@/store/simulation-store";

export default function ChallengesPage() {
  const portfolio = useSimulation((s) => s.portfolio);
  const quotes = Object.values(useSimulation((s) => s.lastQuotes));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Desafíos</h1>
      <p className="text-sm text-muted">
        Puntos y badges virtuales. No hay premios ni dinero real. Nivel estimado:{" "}
        {Math.floor(portfolio.xp / 50) + 1} · {portfolio.xp} XP
      </p>
      {portfolio.badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {portfolio.badges.map((b) => (
            <span key={b} className="rounded-full border border-accent px-3 py-1 text-sm">
              {b}
            </span>
          ))}
        </div>
      )}
      <div className="space-y-3">
        {CHALLENGES.map((c) => {
          const { ok, hint } = c.check(portfolio, quotes);
          const done = ok || portfolio.badges.includes(c.badge);
          return (
            <article key={c.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{c.title}</h2>
                  <p className="mt-1 text-sm text-muted">{c.description}</p>
                  <p className="mt-2 text-xs text-muted">{hint}</p>
                </div>
                <span className={`text-sm ${done ? "text-gain" : "text-muted"}`}>
                  {done ? "Completado" : `+${c.xp} XP`}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
