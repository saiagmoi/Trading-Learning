// Local single-server runner. Start separately; closing this process stops updates.
const base = new URL(process.env.COMPETITION_URL || "http://localhost:3000");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) {
  throw new Error("El proceso de competencia solo admite una URL local.");
}
const token = process.env.COMPETITION_ACCESS_TOKEN;
if (!token) throw new Error("Configurá COMPETITION_ACCESS_TOKEN en .env.local y reiniciá la aplicación antes de iniciar este proceso.");
let stopped = false;
process.on("SIGINT", () => { stopped = true; });
process.on("SIGTERM", () => { stopped = true; });
console.log("Competencia: actualizaciones locales activas. La aplicación debe permanecer encendida. Ctrl+C para detener.");
while (!stopped) {
  try {
    const res = await fetch(new URL("/api/competition", base), {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "review" }), signal: AbortSignal.timeout(300_000),
    });
    const data = await res.json();
    if (!res.ok) console.error(data.error || `Error ${res.status}`);
    else {
      console.log(`${new Date().toLocaleString("es-AR")}: ${data.competition?.notice || "Sin novedades"}`);
      if (data.competition?.status === "finished") stopped = true;
    }
  } catch { console.error("No se pudo conectar con la aplicación local. Se reintentará en un minuto."); }
  if (!stopped) await new Promise((resolve) => {
    const interval = setInterval(() => { if (stopped) { clearInterval(interval); clearTimeout(timer); resolve(); } }, 500);
    const timer = setTimeout(() => { clearInterval(interval); resolve(); }, 60_000);
  });
}
console.log("Actualizaciones detenidas.");
