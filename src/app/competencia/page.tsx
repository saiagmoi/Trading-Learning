"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCatalogAssets } from "@/lib/assets";
import { formatDateTime, formatMoney, formatPercent, pnlClass } from "@/lib/format";
import { AGENT_IDS, NAMES, STRATEGIES, type CompetitionView, type ParticipantId } from "@/lib/competition/types";
import { maxDrawdown, PARTICIPANTS, value } from "@/lib/competition/engine";

const COLORS: Record<ParticipantId, string> = { you: "#e8c547", spy: "#8b95a8", patient: "#3dd68c", momentum: "#4c8dff", analyst: "#c084fc" };
const LABELS = { buy: "Compra", sell: "Venta", hold: "Espera", error: "Sin ejecutar", review: "Evaluación" };

export default function CompetitionPage() {
  const [data, setData] = useState<CompetitionView | null>(null);
  const [error, setError] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [accessInput, setAccessInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [capital, setCapital] = useState("10000");
  const [auto, setAuto] = useState(false);
  const [selected, setSelected] = useState<ParticipantId | "all">("all");
  const [symbol, setSymbol] = useState("SPY");
  const [side, setSide] = useState("hold");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const inFlight = useRef(false);
  const c = data?.competition;
  const assets = getCatalogAssets().filter((a) => a.market === "US" && a.currency === "USD");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/competition", { cache: "no-store", headers: accessToken ? { "x-competition-token": accessToken } : {} })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        if (!cancelled) setData(body);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "No se pudo cargar la competencia."); });
    return () => { cancelled = true; };
  }, [accessToken]);
  const act = useCallback(async (input: object) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const res = await fetch("/api/competition", { method: "POST", headers: { "Content-Type": "application/json", ...(accessToken ? { "x-competition-token": accessToken } : {}) }, body: JSON.stringify(input) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setData(body); setConfirm(false);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar la acción."); }
    finally { setBusy(false); inFlight.current = false; }
  }, [accessToken]);
  useEffect(() => {
    if (!auto || c?.status !== "active") return;
    const timer = setInterval(() => void act({ action: "review" }), 60_000);
    return () => clearInterval(timer);
  }, [auto, c?.status, act]);

  const ranking = c ? PARTICIPANTS.map((id) => ({ id, value: value(c.portfolios[id], c.quotes) })).sort((a, b) => b.value - a.value) : [];
  const spyReturn = c ? (value(c.portfolios.spy, c.quotes) / c.initialCapital - 1) * 100 : 0;
  const points = c?.snapshots ?? [];
  const graphValues = points.flatMap((p) => Object.values(p.values).map((v) => v / (c?.initialCapital ?? 1) * 100));
  const low = Math.min(99, ...graphValues); const high = Math.max(101, ...graphValues);
  const exportResults = () => {
    if (!c) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(c, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `competencia-${c.startedAt.slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs uppercase tracking-widest text-accent">Laboratorio de inversión · 6 semanas</p><h1 className="mt-2 text-3xl font-semibold">Vos, el mercado y tres agentes</h1><p className="mt-2 max-w-2xl text-sm text-muted">Cinco carteras, el mismo capital y decisiones con explicación. Esperar también es una estrategia: nadie está obligado a comprar ni a vender.</p></div>
      <span className="rounded-full border border-line px-3 py-2 text-xs">{c ? c.status === "active" ? c.scheduledFor && new Date(c.scheduledFor).getTime() > new Date(data!.now).getTime() ? "◷ Ronda programada" : "● Ronda activa" : c.status === "paused" ? "Ⅱ Ronda pausada" : "Ronda finalizada" : "Antes de empezar"}</span>
    </div>

    <div className="grid gap-4 lg:grid-cols-3">{AGENT_IDS.map((id) => {
      const s = STRATEGIES[id];
      const last = c?.decisions.find((d) => d.participant === id);
      return <article key={id} className="card flex flex-col p-5" style={{ borderTop: `3px solid ${s.color}` }}>
        <p className="text-2xl" aria-hidden="true">{s.icon}</p><h2 className="mt-3 text-xl font-semibold">IA · {s.title}</h2><p className="mt-1 text-sm" style={{ color: s.color }}>{s.subtitle}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted">{s.description}</p>
        <div className="mt-4 rounded-xl bg-bg p-3"><p className="text-xs font-semibold text-ink">Cuándo espera</p><p className="mt-1 text-xs leading-relaxed text-muted">{s.wait}</p></div>
        <p className="mt-4 text-xs text-muted">{c?.lastReview[id] ? `Última evaluación: ${formatDateTime(c.lastReview[id]!)}` : "Primera evaluación pendiente"}</p>
        <p className="mt-2 text-sm">{last ? `${LABELS[last.action]} · ${last.reason}` : "Todavía no tomó decisiones. Puede comenzar y seguir en efectivo."}</p>
      </article>;
    })}</div>

    {error && <p role="alert" className="rounded-xl border border-loss/40 bg-loss/10 p-3 text-sm text-loss">{error}</p>}
    {!data && !error && <p className="text-muted" role="status">Cargando competencia…</p>}
    {data?.setup?.hosted && (!data.setup.storageReady || !data.setup.accessConfigured || !data.setup.cronConfigured) && <section className="card border-warn/40 p-5">
      <h2 className="font-semibold text-warn">Terminá de conectar la competencia en Vercel</h2>
      <p className="mt-2 text-sm text-muted">La web ya admite acceso desde internet. Falta completar la configuración privada del proyecto para guardar tus carteras y actualizarlas con la computadora apagada.</p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
        {!data.setup.storageReady && <li>En Storage, conectá un almacén Vercel Blob de acceso <strong>privado</strong>. Vercel agregará la conexión al proyecto.</li>}
        {!data.setup.accessConfigured && <li>Agregá COMPETITION_ACCESS_TOKEN en las variables de entorno: es una clave de acceso que elegís para esta competencia, distinta de tu clave de OpenAI.</li>}
        {!data.setup.cronConfigured && <li>Agregá CRON_SECRET con un valor aleatorio privado para proteger la actualización diaria.</li>}
      </ul>
      <p className="mt-3 text-sm text-muted">Guardá los cambios para Production y volvé a desplegar el proyecto. No pegues claves en GitHub.</p>
      <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-accent">Abrir Vercel →</a>
    </section>}
    {data?.setup?.hosted && data.setup.accessConfigured && !data.setup.authorized && <form className="card p-5" onSubmit={(event) => { event.preventDefault(); setError(""); setAccessToken(accessInput); setAccessInput(""); }}>
      <h2 className="font-semibold">Entrá a tu competencia</h2>
      <p className="mt-2 text-sm text-muted">Ingresá la clave de acceso de esta competencia. No es tu clave de API de OpenAI. Solo permanece en memoria durante esta visita.</p>
      <label className="mt-3 block text-sm">Clave de acceso<input type="password" autoComplete="current-password" value={accessInput} onChange={(e) => setAccessInput(e.target.value)} className="mt-1 block w-full max-w-md rounded-xl border border-line bg-bg px-3 py-2" /></label>
      <button type="submit" disabled={!accessInput} className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Entrar</button>
    </form>}
    {data && !data.connection.ready && <section className="card border-warn/40 p-5">
      <h2 className="font-semibold text-warn">Falta conectar la IA para empezar</h2>
      <p className="mt-2 text-sm text-muted">Los tres agentes y sus reglas están preparados. Para tomar decisiones reales necesitan una conexión de IA en el servidor. No se generan respuestas ficticias mientras falta esa conexión.</p>
      <details className="mt-3 text-sm"><summary className="cursor-pointer text-accent">Cómo conectar los agentes</summary><p className="mt-2 text-muted">Configurá OPENAI_API_KEY y OPENAI_MODEL en las variables de entorno del proyecto en Vercel y volvé a desplegar. En uso local, esas variables van en .env.local. La clave queda en el servidor; nunca la pegues en el chat ni en el navegador. El uso de la API tiene su propia facturación.</p></details>
    </section>}

    {!c && data && data.setup?.authorized !== false && <section className="card p-5">
      <h2 className="text-lg font-semibold">Una salida igual para todos</h2>
      <p className="mt-2 text-sm text-muted">Se crea una cuenta nueva para vos, SPY y cada agente. Tu cartera de práctica habitual queda separada. No se permiten aportes durante la ronda.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm">Capital virtual por participante (USD)<input type="number" min="100" max="1000000" value={capital} onChange={(e) => setCapital(e.target.value)} className="mt-1 block rounded-xl border border-line bg-bg px-3 py-2" /></label><button disabled={busy || !data.connection.ready || data.setup?.storageReady === false || (data.setup?.hosted && !data.setup.cronConfigured)} onClick={() => void act({ action: "start", capital: Number(capital) })} className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-white disabled:opacity-40">{busy ? "Preparando…" : "Iniciar ronda de 6 semanas"}</button></div>
      <p className="mt-3 text-xs text-muted">Podés iniciar con el mercado cerrado. Las inversiones se habilitan en la próxima rueda a las 12:00 de Argentina. Hasta entonces, todos esperan en efectivo.</p>
    </section>}

    {c && <>
      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Tu ronda</h2><p className="mt-1 text-xs text-muted">{formatDateTime(c.scheduledFor ?? c.startedAt)} → {formatDateTime(c.endsAt)} · {formatMoney(c.initialCapital, "USD")} cada uno · Modelo: {c.model}</p></div><div className="flex flex-wrap gap-2"><button disabled={busy || c.status !== "active"} onClick={() => void act({ action: "review" })} className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Evaluando…" : "Evaluar agentes / actualizar"}</button>{c.status !== "finished" && <button disabled={busy} onClick={() => void act({ action: c.status === "paused" ? "resume" : "pause" })} className="rounded-xl border border-line px-3 py-2 text-sm disabled:opacity-40">{c.status === "paused" ? "Reanudar" : "Pausar"}</button>}<button onClick={exportResults} className="rounded-xl border border-line px-3 py-2 text-sm">Descargar resultados</button></div></div>
        <p className="rounded-xl bg-bg p-3 text-sm text-muted" role="status">{c.notice}{c.scheduledFor && <span className="mt-2 block">Primeras inversiones habilitadas: {formatDateTime(c.scheduledFor)} · Evaluación diaria a las 12:00 de Argentina.</span>}</p>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); if (e.target.checked) void act({ action: "review" }); }} className="mt-1" /><span>Actualizar automáticamente mientras esta página esté abierta<span className="mt-1 block text-xs text-muted">Consulta cada minuto; cada agente decide como máximo una vez por rueda desde las 12:00 de Argentina. Activarlo no obliga a operar. La automatización diaria funciona por separado, sin esta página.</span></span></label>
      </section>

      <section className="card overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><caption className="px-4 py-3 text-left text-lg font-semibold">Tabla de posiciones</caption><thead className="border-b border-line text-xs text-muted"><tr><th className="px-4 py-3">Participante</th><th>Patrimonio</th><th>Rendimiento neto</th><th>Vs. SPY</th><th>Efectivo</th><th>Caída máxima*</th></tr></thead><tbody>{ranking.map((r, i) => {
        const ret = (r.value / c.initialCapital - 1) * 100;
        return <tr key={r.id} className="border-b border-line"><td className="px-4 py-4"><span className="mr-2 text-muted">{i + 1}.</span><span style={{ color: COLORS[r.id] }}>{NAMES[r.id]}</span></td><td className="num">{formatMoney(r.value, "USD")}</td><td className={`num ${pnlClass(ret)}`}>{formatPercent(ret)}</td><td className="num">{(ret - spyReturn).toFixed(2)} pp</td><td className="num">{formatMoney(c.portfolios[r.id].cash.USD, "USD")}</td><td className="num">{formatPercent(maxDrawdown(c, r.id))}</td></tr>;
      })}</tbody></table><p className="px-4 py-3 text-xs text-muted">Última valuación: {points.at(-1) ? formatDateTime(points.at(-1)!.at) : "pendiente"}. *Caída calculada con las fotos diarias guardadas; no representa la peor caída intradiaria.</p></section>

      <section className="card p-5"><h2 className="font-semibold">Evolución · todos empiezan en 100</h2>{points.length < 2 ? <p className="mt-3 text-sm text-muted">El gráfico aparece cuando haya registros de al menos dos días distintos.</p> : <><svg viewBox="0 0 760 220" className="mt-4 w-full" role="img" aria-label="Evolución del patrimonio de los cinco participantes, normalizada a 100"><text x="0" y="16" fill="#8b95a8" fontSize="12">{high.toFixed(1)}</text><text x="0" y="205" fill="#8b95a8" fontSize="12">{low.toFixed(1)}</text><line x1="48" x2="750" y1={200 - (100 - low) / (high - low) * 180} y2={200 - (100 - low) / (high - low) * 180} stroke="#232a3b" strokeDasharray="4 4" />{PARTICIPANTS.map((id) => <polyline key={id} fill="none" stroke={COLORS[id]} strokeWidth="2" points={points.map((p) => `${48 + (new Date(p.at).getTime() - new Date(points[0].at).getTime()) / Math.max(1, new Date(points.at(-1)!.at).getTime() - new Date(points[0].at).getTime()) * 700},${200 - (p.values[id] / c.initialCapital * 100 - low) / (high - low) * 180}`).join(" ")} />)}</svg><div className="flex justify-between text-xs text-muted"><span>{formatDateTime(points[0].at)}</span><span>{formatDateTime(points.at(-1)!.at)}</span></div></>}<div className="mt-3 flex flex-wrap gap-4 text-xs">{PARTICIPANTS.map((id) => <span key={id} style={{ color: COLORS[id] }}>● {NAMES[id]}</span>)}</div></section>

      <section className="grid gap-4 lg:grid-cols-2"><div className="card p-5"><h2 className="text-lg font-semibold">Tu decisión</h2><p className="mt-2 text-sm text-muted">Esperar conserva tus posiciones y tu efectivo. No hace falta operar para participar.</p>
        <label className="mt-4 block text-sm">Qué querés hacer<select disabled={busy} value={side} onChange={(e) => { setSide(e.target.value); setConfirm(false); }} className="mt-1 w-full rounded-xl border border-line bg-bg p-2"><option value="hold">Esperar / mantener</option><option value="buy">Comprar</option><option value="sell">Vender</option></select></label>
        {side !== "hold" && <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-sm">Activo<select disabled={busy} value={symbol} onChange={(e) => { setSymbol(e.target.value); setConfirm(false); }} className="mt-1 w-full rounded-xl border border-line bg-bg p-2">{assets.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}</select></label><label className="text-sm">Cantidad<input disabled={busy} type="number" min="0.000001" step="0.000001" value={qty} onChange={(e) => { setQty(e.target.value); setConfirm(false); }} className="mt-1 w-full rounded-xl border border-line bg-bg p-2" /></label></div>}
        <label className="mt-3 block text-sm">Tu motivo<textarea disabled={busy} maxLength={1000} value={reason} onChange={(e) => { setReason(e.target.value); setConfirm(false); }} placeholder="Por ejemplo: prefiero esperar porque todavía no tengo una idea clara." className="mt-1 min-h-24 w-full rounded-xl border border-line bg-bg p-3 text-sm" /></label>
        {confirm ? <div className="mt-3 rounded-xl border border-warn/40 p-3"><p className="text-sm">{side === "hold" ? "Registrar que preferís esperar." : `${side === "buy" ? "Comprar" : "Vender"} ${qty} unidades de ${symbol} con dinero virtual. La ejecución usa la cotización reciente y los costos de la ronda.`}</p><div className="mt-3 flex gap-3"><button disabled={busy} onClick={() => void act({ action: side === "hold" ? "hold" : "trade", side, symbol, quantity: Number(qty), reason })} className="rounded-xl bg-accent px-4 py-2 text-sm text-white disabled:opacity-40">Confirmar</button><button disabled={busy} onClick={() => setConfirm(false)} className="text-sm text-muted">Cancelar</button></div></div> : <button disabled={busy || c.status !== "active" || !reason.trim()} onClick={() => setConfirm(true)} className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{side === "hold" ? "Registrar espera" : "Revisar operación"}</button>}
      </div><div className="card p-5"><h2 className="text-lg font-semibold">Tus posiciones de competencia</h2><p className="mt-2 text-sm text-muted">Efectivo: {formatMoney(c.portfolios.you.cash.USD, "USD")}</p>{!c.portfolios.you.positions.length && <p className="mt-4 text-sm text-muted">Todavía estás en efectivo. Está bien esperar.</p>}<ul className="mt-3 divide-y divide-line">{c.portfolios.you.positions.map((p) => <li key={p.symbol} className="flex justify-between py-3 text-sm"><span>{p.symbol}</span><span className="num">{p.quantity.toLocaleString("es-AR", { maximumFractionDigits: 6 })} unidades</span></li>)}</ul><p className="mt-5 text-xs text-muted">Esta cuenta es independiente de “Mi cartera”. Las operaciones para la competencia se hacen acá.</p></div></section>

      <section className="card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Diario de decisiones</h2><label className="text-xs text-muted">Participante<select value={selected} onChange={(e) => setSelected(e.target.value as ParticipantId | "all")} className="ml-2 rounded-lg border border-line bg-bg p-2 text-sm"><option value="all">Todos</option>{PARTICIPANTS.map((id) => <option key={id} value={id}>{NAMES[id]}</option>)}</select></label></div>
        <div className="mt-4 max-h-[560px] divide-y divide-line overflow-y-auto">{c.decisions.filter((d) => selected === "all" || d.participant === selected).slice(0, 100).map((d) => <article key={d.id} className="py-4"><div className="flex flex-wrap justify-between gap-2 text-xs"><p style={{ color: COLORS[d.participant] }}>{NAMES[d.participant]} · {LABELS[d.action]}{d.symbol ? ` · ${d.symbol}` : ""}</p><time className="text-muted">{formatDateTime(d.at)}</time></div><p className="mt-2 text-sm leading-relaxed">{d.reason}</p>{d.quantity && <p className="mt-2 text-xs text-muted">{d.quantity} unidades · precio {formatMoney(d.price ?? 0, "USD")} · comisión {formatMoney(d.commission ?? 0, "USD")}</p>}{d.model && <p className="mt-1 text-xs text-muted">Modelo: {d.model}</p>}</article>)}{!c.decisions.length && <p className="py-3 text-sm text-muted">Todavía no hay decisiones. Evaluá a los agentes o registrá tu primera espera.</p>}</div>
      </section>
    </>}

    <details className="card p-5"><summary className="cursor-pointer font-semibold">Reglas, datos y automatización</summary><div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
      <p>Los cinco participantes empiezan con el mismo capital en USD. SPY aproxima al S&P 500: compra una vez y mantiene. Vos podés operar o esperar; los tres agentes se evalúan cada día de mercado desde las 12:00 de Argentina. No hay compras o ventas obligatorias.</p>
      <p>Todos usan los mismos costos: 0,1 % de comisión, mínimo USD 1 por operación, spread de 5 puntos básicos y deslizamiento de 2 puntos básicos. No hay aportes, préstamos ni ventas en corto. Los agentes tienen como máximo cinco posiciones y 20 % por posición al asignar; los pesos pueden variar después con el mercado.</p>
      <p>Las operaciones se simulan con la última cotización reciente de Yahoo, que puede tener retraso. No son ejecuciones de un broker ni órdenes a la próxima apertura. Los resultados son variaciones de precio netas de los costos simulados: esta versión no acredita dividendos ni ajusta las unidades de la cartera por splits. Un evento corporativo puede distorsionar la comparación.</p>
      <p>{data?.setup?.hosted ? "En Vercel, las carteras se guardan en almacenamiento privado persistente. La tarea diaria se ejecuta en la nube desde las 12:00 de Argentina: no necesitás abrir esta web ni mantener tu Mac encendida. En el plan Hobby puede comenzar dentro de la hora programada, según Vercel." : "En uso local, las carteras se guardan en esta computadora. La automatización local de Codex necesita la Mac encendida; la versión publicada en Vercel usa su propio almacenamiento privado y tarea diaria."}</p>
      <p>Los datos y titulares disponibles se envían al modelo configurado; la respuesta se valida antes de operar. Si faltan datos, falla el modelo o se incumplen reglas, se conserva la cartera y se registra el motivo. Los fallos se reintentan en la próxima rueda. La selección de modelo se fija al iniciar la ronda.</p>
      <p>Las seis semanas se cuentan desde la fecha programada para la primera rueda. El plazo sigue corriendo durante pausas o desconexiones. Al finalizar se conserva la última valuación registrada antes del fin, con su fecha visible. Se guardan fotos diarias; no se reconstruyen decisiones perdidas. Seis semanas sirven para observar esta ronda, no para probar superioridad de una estrategia.</p>
    </div></details>
  </div>;
}
