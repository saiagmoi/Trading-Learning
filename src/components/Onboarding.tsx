"use client";

import { useState } from "react";
import { useSimulation } from "@/store/simulation-store";

const CAPITALS = [1000, 5000, 10000, 50000];
const INTERESTS = [
  { id: "stocks", label: "Acciones" },
  { id: "etf", label: "ETFs" },
  { id: "ar", label: "Mercado argentino" },
  { id: "us", label: "Mercado estadounidense" },
  { id: "trading", label: "Trading" },
  { id: "long", label: "Inversión a largo plazo" },
];

export function Onboarding() {
  const complete = useSimulation((s) => s.completeOnboarding);
  const [capital, setCapital] = useState(10000);
  const [custom, setCustom] = useState("");
  const [interests, setInterests] = useState<string[]>(["stocks", "us"]);
  const [beginner, setBeginner] = useState(true);

  const amount = custom ? Number(custom.replace(",", ".")) : capital;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card max-h-[92vh] w-full max-w-lg overflow-auto p-6">
        <p className="text-xs uppercase tracking-widest text-warn">Simulación educativa · dinero virtual</p>
        <h1 className="mt-3 text-2xl font-semibold">👋 Bienvenido al simulador</h1>
        <p className="mt-2 text-muted">
          Acá podés aprender a invertir sin arriesgar dinero real. Nada de lo que hagas mueve plata
          de verdad ni se conecta a un banco.
        </p>

        <h2 className="mt-6 text-sm font-medium">¿Cuánto dinero virtual querés recibir?</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {CAPITALS.map((n) => (
            <button
              key={n}
              onClick={() => {
                setCapital(n);
                setCustom("");
              }}
              className={`rounded-xl border px-3 py-3 text-sm ${
                !custom && capital === n ? "border-accent bg-bg" : "border-line"
              }`}
            >
              USD {n.toLocaleString("es-AR")}
            </button>
          ))}
        </div>
        <input
          className="mt-2 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm"
          placeholder="Personalizado en USD"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />

        <h2 className="mt-6 text-sm font-medium">¿Qué querés aprender?</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {INTERESTS.map((i) => {
            const on = interests.includes(i.id);
            return (
              <button
                key={i.id}
                onClick={() =>
                  setInterests((prev) =>
                    on ? prev.filter((x) => x !== i.id) : [...prev, i.id],
                  )
                }
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  on ? "border-accent bg-bg" : "border-line text-muted"
                }`}
              >
                {i.label}
              </button>
            );
          })}
        </div>

        <label className="mt-6 flex items-start gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={beginner}
            onChange={(e) => setBeginner(e.target.checked)}
            className="mt-1"
          />
          Modo principiante: textos extra y menos jerga de entrada.
        </label>

        <button
          className="mt-6 w-full rounded-xl bg-accent py-3 font-medium text-black"
          onClick={() =>
            complete({
              capitalUsd: Number.isFinite(amount) && amount > 0 ? amount : 10000,
              interests,
              beginnerMode: beginner,
            })
          }
        >
          Empezar a practicar
        </button>
        <p className="mt-3 text-xs text-muted">
          El objetivo de esta herramienta es aprender, no brindar asesoramiento financiero.
        </p>
      </div>
    </div>
  );
}
