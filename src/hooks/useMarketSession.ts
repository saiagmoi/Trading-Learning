"use client";
import { useEffect, useState } from "react";
import { getMarketHours } from "@/lib/market/hours";
import type { Market } from "@/lib/types";

export function useMarketSession(market: Market) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, []);
  return { ...getMarketHours(market, now), now };
}
