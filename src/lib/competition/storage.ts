import { mkdir, readFile, rename, writeFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { Competition } from "./types";

const directory = path.resolve(process.env.COMPETITION_DATA_DIR || path.join(process.cwd(), ".data"));
const filename = path.join(directory, "competition.json");
const lockDirectory = path.join(directory, "competition.lock");
const shared = globalThis as typeof globalThis & { competitionQueue?: Promise<unknown> };

async function diskLock() {
  await mkdir(directory, { recursive: true });
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      await mkdir(lockDirectory);
      try { await writeFile(path.join(lockDirectory, "owner.json"), JSON.stringify({ pid: process.pid }), { mode: 0o600 }); }
      catch (error) { await rm(lockDirectory, { recursive: true, force: true }); throw error; }
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const owner = JSON.parse(await readFile(path.join(lockDirectory, "owner.json"), "utf8"));
        try { process.kill(owner.pid, 0); }
        catch (e) {
          if ((e as NodeJS.ErrnoException).code === "ESRCH") await rm(lockDirectory, { recursive: true, force: true });
        }
      } catch {
        // A process may be writing its owner record. Only reclaim abandoned empty locks.
        try { if (Date.now() - (await stat(lockDirectory)).mtimeMs > 60_000) await rm(lockDirectory, { recursive: true, force: true }); }
        catch { /* Another contender has already released the lock. */ }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("La competencia está siendo actualizada. Volvé a intentar en unos minutos.");
}
export function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = (shared.competitionQueue ?? Promise.resolve()).catch(() => {}).then(async () => {
    await diskLock();
    try { return await fn(); }
    finally { await rm(lockDirectory, { recursive: true, force: true }); }
  });
  shared.competitionQueue = next.catch(() => {});
  return next;
}
export async function readCompetition(): Promise<Competition | null> {
  try {
    const c = JSON.parse(await readFile(filename, "utf8")) as Competition;
    if (c.version !== 1 || !c.id || !c.portfolios) throw new Error("El archivo de competencia no es compatible. Conservá una copia antes de revisarlo.");
    return c;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
export async function writeCompetition(c: Competition) {
  await mkdir(directory, { recursive: true });
  const temp = `${filename}.${crypto.randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(c, null, 2), { mode: 0o600 });
  await rename(temp, filename);
}
