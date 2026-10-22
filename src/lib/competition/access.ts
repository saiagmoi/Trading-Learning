import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export function isLocalRequest(req: NextRequest) {
  return process.env.VERCEL !== "1" && ["localhost", "127.0.0.1", "[::1]"].includes(req.nextUrl.hostname);
}
export function secretMatches(supplied: string | null, expected: string | undefined) {
  if (!supplied || !expected) return false;
  return timingSafeEqual(createHash("sha256").update(supplied).digest(), createHash("sha256").update(expected).digest());
}
export function hasOwnerAccess(req: NextRequest) {
  if (isLocalRequest(req)) return true;
  return secretMatches(req.headers.get("x-competition-token"), process.env.COMPETITION_ACCESS_TOKEN);
}
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const source = new URL(origin);
    return source.host === req.headers.get("host") && source.protocol === req.nextUrl.protocol;
  } catch { return false; }
}
export function canMutate(req: NextRequest) {
  if (sameOrigin(req) && hasOwnerAccess(req)) return true;
  // Retain the authenticated local worker; cloud cron has a separate endpoint.
  return isLocalRequest(req) && secretMatches(req.headers.get("authorization"), process.env.COMPETITION_ACCESS_TOKEN ? `Bearer ${process.env.COMPETITION_ACCESS_TOKEN}` : undefined);
}
