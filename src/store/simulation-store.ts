"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CHALLENGES } from "@/lib/education/challenges";
import {
  addCash,
  cancelOrder,
  emptyPortfolio,
  executeMarket,
  matchPendingOrders,
  placeWorkingOrder,
  portfolioValueUsd,
  previewOrder,
} from "@/lib/simulation/engine";
import { REALISM_PRESETS } from "@/lib/simulation/realism";
import type {
  CommissionConfig,
  Currency,
  OrderType,
  Portfolio,
  Price,
  RealismLevel,
  UserProfile,
} from "@/lib/types";

export interface AppState {
  onboarded: boolean;
  profile: UserProfile | null;
  portfolio: Portfolio;
  lastQuotes: Record<string, Price>;
  lastFx: { rate: number; at: string; source: string } | null;
  customCommissions: Partial<CommissionConfig> | null;
  error: string | null;
  completeOnboarding: (input: {
    capitalUsd: number;
    interests: string[];
    beginnerMode: boolean;
  }) => void;
  addVirtualCash: (amount: number, currency: Currency) => void;
  setDisplayCurrency: (c: Currency) => void;
  setBeginnerMode: (v: boolean) => void;
  setRealism: (level: RealismLevel) => void;
  setCustomCommissions: (config: Partial<CommissionConfig> | null) => void;
  updateQuotes: (quotes: Price[]) => void;
  setFx: (rate: number, at: string, source: string) => void;
  buyMarket: (symbol: string, qty: number) => void;
  sellMarket: (symbol: string, qty: number) => void;
  preview: (symbol: string, side: "buy" | "sell", qty: number, order?: { type: OrderType; limitPrice?: number; stopPrice?: number }) => ReturnType<typeof previewOrder>;
  placeOrder: (input: {
    symbol: string;
    side: "buy" | "sell";
    type: OrderType;
    quantity: number;
    limitPrice?: number;
    stopPrice?: number;
  }) => void;
  cancel: (orderId: string) => void;
  toggleWatch: (symbol: string) => void;
  resetSimulation: (capitalUsd: number) => void;
  markChallenge: (id: string) => void;
  addXp: (n: number, badge?: string) => void;
}

export function getActiveCommission(
  profile: UserProfile | null,
  custom: Partial<CommissionConfig> | null,
): CommissionConfig {
  const base = REALISM_PRESETS[profile?.realismLevel ?? "beginner"];
  if (!custom) return base;
  return { ...base, ...custom };
}

function defaultPortfolio(usd: number): Portfolio {
  return emptyPortfolio({ USD: usd, ARS: 0 });
}

export const useSimulation = create<AppState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      profile: null,
      portfolio: defaultPortfolio(10_000),
      lastQuotes: {},
      lastFx: null,
      customCommissions: null,
      error: null,

      completeOnboarding: ({ capitalUsd, interests, beginnerMode }) => {
        const profile: UserProfile = {
          id: crypto.randomUUID(),
          displayName: "Inversor en práctica",
          createdAt: new Date().toISOString(),
          beginnerMode,
          displayCurrency: "USD",
          realismLevel: beginnerMode ? "beginner" : "realistic",
          interests,
          initialCapital: { USD: capitalUsd, ARS: 0 },
        };
        set({
          onboarded: true,
          profile,
          portfolio: defaultPortfolio(capitalUsd),
          error: null,
        });
      },

      addVirtualCash: (amount, currency) => {
        try {
          set({ portfolio: addCash(get().portfolio, amount, currency), error: null });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : "No se pudo agregar dinero" });
        }
      },

      setDisplayCurrency: (c) => {
        const profile = get().profile;
        if (!profile) return;
        set({ profile: { ...profile, displayCurrency: c } });
      },

      setBeginnerMode: (v) => {
        const profile = get().profile;
        if (!profile) return;
        set({ profile: { ...profile, beginnerMode: v } });
      },

      setRealism: (level) => {
        const profile = get().profile;
        if (!profile) return;
        set({ profile: { ...profile, realismLevel: level } });
      },

      setCustomCommissions: (config) => set({ customCommissions: config }),

      updateQuotes: (quotes) => {
        const map = { ...get().lastQuotes };
        for (const q of quotes) map[q.symbol] = q;
        const { profile, portfolio, lastFx, customCommissions } = get();
        const config = getActiveCommission(profile, customCommissions);
        const matched = matchPendingOrders(
          portfolio,
          quotes,
          config,
          profile?.realismLevel ?? "beginner",
        );
        const value = portfolioValueUsd(
          matched.positions,
          Object.values(map),
          matched.cash,
          lastFx?.rate ?? null,
        );
        const lastPoint = matched.equityHistory[matched.equityHistory.length - 1];
        const now = Math.floor(Date.now() / 1000);
        if (!lastPoint || now - lastPoint.time > 60) {
          matched.equityHistory = [
            ...matched.equityHistory.slice(-400),
            { time: now, valueUsd: value },
          ];
        }
        let xp = matched.xp;
        const badges = [...matched.badges];
        const challenges = [...matched.challenges];
        for (const def of CHALLENGES) {
          if (badges.includes(def.badge)) continue;
          const { ok } = def.check(matched, Object.values(map));
          if (ok) {
            badges.push(def.badge);
            xp += def.xp;
            challenges.push({
              id: def.id,
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              status: "completed",
            });
          }
        }
        matched.xp = xp;
        matched.badges = badges;
        matched.challenges = challenges;
        set({ lastQuotes: map, portfolio: matched });
      },

      setFx: (rate, at, source) => set({ lastFx: { rate, at, source } }),

      buyMarket: (symbol, qty) => {
        const { portfolio, lastQuotes, profile, customCommissions } = get();
        const q = lastQuotes[symbol];
        if (!q) {
          set({ error: "Todavía no hay cotización para ese activo." });
          return;
        }
        try {
          const config = getActiveCommission(profile, customCommissions);
          const res = executeMarket(
            portfolio,
            symbol,
            "buy",
            qty,
            q.price,
            config,
            profile?.realismLevel ?? "beginner",
            { quote: q },
          );
          set({ portfolio: res.portfolio, error: null });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : "No se pudo comprar" });
        }
      },

      sellMarket: (symbol, qty) => {
        const { portfolio, lastQuotes, profile, customCommissions } = get();
        const q = lastQuotes[symbol];
        if (!q) {
          set({ error: "Todavía no hay cotización para ese activo." });
          return;
        }
        try {
          const config = getActiveCommission(profile, customCommissions);
          const res = executeMarket(
            portfolio,
            symbol,
            "sell",
            qty,
            q.price,
            config,
            profile?.realismLevel ?? "beginner",
            { quote: q },
          );
          set({ portfolio: res.portfolio, error: null });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : "No se pudo vender" });
        }
      },

      preview: (symbol, side, qty, order) => {
        const { portfolio, lastQuotes, profile, customCommissions } = get();
        const q = lastQuotes[symbol];
        if (!q) throw new Error("Sin cotización.");
        const config = getActiveCommission(profile, customCommissions);
        if (order && order.type !== "market") {
          placeWorkingOrder(portfolio, { symbol, side, quantity: qty, ...order }, config);
          const reference = order.type === "stop" ? q.price : order.limitPrice!;
          return previewOrder(portfolio, symbol, side, qty, reference, { ...config, spreadBps: 0, slippageBps: 0 });
        }
        return previewOrder(
          portfolio,
          symbol,
          side,
          qty,
          q.price,
          config,
        );
      },

      placeOrder: (input) => {
        const { portfolio, lastQuotes, profile, customCommissions } = get();
        if (input.type === "market") {
          if (input.side === "buy") get().buyMarket(input.symbol, input.quantity);
          else get().sellMarket(input.symbol, input.quantity);
          return;
        }
        const q = lastQuotes[input.symbol];
        if (!q) {
          set({ error: "Sin cotización para crear la orden." });
          return;
        }
        try {
          const config = getActiveCommission(profile, customCommissions);
          set({
            portfolio: placeWorkingOrder(portfolio, {
              symbol: input.symbol,
              side: input.side,
              type: input.type,
              quantity: input.quantity,
              limitPrice: input.limitPrice,
              stopPrice: input.stopPrice,
            }, config),
            error: null,
          });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : "No se pudo crear la orden" });
        }
      },

      cancel: (orderId) => set({ portfolio: cancelOrder(get().portfolio, orderId) }),

      toggleWatch: (symbol) => {
        const p = structuredClone(get().portfolio) as Portfolio;
        const exists = p.watchlist.some((w) => w.symbol === symbol);
        p.watchlist = exists
          ? p.watchlist.filter((w) => w.symbol !== symbol)
          : [...p.watchlist, { symbol, addedAt: new Date().toISOString() }];
        set({ portfolio: p });
      },

      resetSimulation: (capitalUsd) => {
        const profile = get().profile;
        set({
          portfolio: defaultPortfolio(capitalUsd),
          error: null,
          profile: profile
            ? { ...profile, initialCapital: { USD: capitalUsd, ARS: 0 } }
            : profile,
        });
      },

      markChallenge: (id) => {
        const p = structuredClone(get().portfolio) as Portfolio;
        if (p.challenges.some((c) => c.id === id && c.status === "completed")) return;
        const def = CHALLENGES.find((c) => c.id === id);
        p.challenges.push({
          id,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          status: "completed",
        });
        if (def && !p.badges.includes(def.badge)) {
          p.badges.push(def.badge);
          p.xp += def.xp;
        }
        set({ portfolio: p });
      },

      addXp: (n, badge) => {
        const p = structuredClone(get().portfolio) as Portfolio;
        p.xp += n;
        if (badge && !p.badges.includes(badge)) p.badges.push(badge);
        set({ portfolio: p });
      },
    }),
    { name: "aula-inversora-v1" },
  ),
);
