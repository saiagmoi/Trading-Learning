"use client";

import Link from "next/link";
import { LESSONS } from "@/lib/education/lessons";

export default function LearnPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Aprender a invertir</h1>
      <p className="text-sm text-muted">
        Explicaciones cortas, pensadas para quien arranca de cero. No son recomendaciones de compra.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {LESSONS.map((l) => (
          <article key={l.id} className="card p-4">
            <h2 className="font-medium">{l.title}</h2>
            <p className="mt-1 text-sm text-muted">{l.summary}</p>
            <p className="mt-3 text-sm leading-relaxed">{l.body}</p>
            {l.example && <p className="mt-2 text-sm text-accent">{l.example}</p>}
            {l.interactive === "dca" && (
              <Link href="/dca" className="mt-3 inline-block text-sm text-accent">
                Probar el simulador de inversión mensual →
              </Link>
            )}
            {l.interactive === "diversify" && (
              <Link href="/desafios" className="mt-3 inline-block text-sm text-accent">
                Desafío de diversificación →
              </Link>
            )}
            {l.interactive === "order" && (
              <Link href="/mercados" className="mt-3 inline-block text-sm text-accent">
                Practicar una orden de mercado →
              </Link>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
