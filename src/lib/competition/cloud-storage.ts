import { AsyncLocalStorage } from "node:async_hooks";
import { get, put, del } from "@vercel/blob";
import type { Competition } from "./types";

const STATE = "competition/state.json";
const LOCK = "competition/lease.json";
const LEASE_MS = 360_000; // Longer than the 300-second function deadline.
const transactions = new AsyncLocalStorage<{ etag?: string; leaseEtag: string; expiresAt: number }>();
export function cloudConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN));
}
function blobAuth() { return process.env.BLOB_READ_WRITE_TOKEN ? { token: process.env.BLOB_READ_WRITE_TOKEN } : {}; }
async function readBlob(path: string) {
  const result = await get(path, { ...blobAuth(), access: "private", useCache: false });
  if (!result) return null;
  if (!result.stream) throw new Error("El almacenamiento no devolvió el registro completo.");
  return { value: JSON.parse(await new Response(result.stream).text()), etag: result.blob.etag };
}
export async function cloudExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const expiresAt = Date.now() + LEASE_MS;
  const body = JSON.stringify({ owner: crypto.randomUUID(), expiresAt });
  let lease;
  try {
    lease = await put(LOCK, body, { ...blobAuth(), access: "private", addRandomSuffix: false, allowOverwrite: false });
  } catch {
    const current = await readBlob(LOCK);
    if (!current) throw new Error("No se pudo bloquear el almacenamiento. Reintentá en unos minutos.");
    if (!Number.isFinite(current.value.expiresAt) || current.value.expiresAt > Date.now()) throw new Error("La competencia se está actualizando. Reintentá en unos minutos.");
    // Only one contender can recover an expired lease.
    lease = await put(LOCK, body, { ...blobAuth(), access: "private", addRandomSuffix: false, allowOverwrite: true, ifMatch: current.etag });
  }
  try { return await transactions.run({ leaseEtag: lease.etag, expiresAt }, fn); }
  finally {
    try { await del(LOCK, { ...blobAuth(), ifMatch: lease.etag }); }
    catch { /* Never remove a lease another invocation has taken over. */ }
  }
}
export async function readCloudCompetition(): Promise<Competition | null> {
  const result = await readBlob(STATE);
  const tx = transactions.getStore();
  if (tx) tx.etag = result?.etag;
  if (!result) return null;
  if (result.value.version !== 1 || !result.value.id || !result.value.portfolios) throw new Error("El registro guardado no es compatible. No se reemplazó.");
  return result.value as Competition;
}
export async function writeCloudCompetition(c: Competition) {
  const tx = transactions.getStore();
  if (!tx || Date.now() >= tx.expiresAt) throw new Error("La actualización perdió su bloqueo. Se conserva la última versión guardada.");
  const saved = await put(STATE, JSON.stringify(c), {
    ...blobAuth(), access: "private", contentType: "application/json", addRandomSuffix: false,
    allowOverwrite: Boolean(tx.etag), ...(tx.etag ? { ifMatch: tx.etag } : {}),
  });
  tx.etag = saved.etag;
}
