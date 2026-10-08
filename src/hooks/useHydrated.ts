"use client";

import { useSyncExternalStore } from "react";
import { useSimulation } from "@/store/simulation-store";

function subscribe(callback: () => void) {
  return useSimulation.persist.onFinishHydration(callback);
}

function getSnapshot() {
  return useSimulation.persist.hasHydrated();
}

function getServerSnapshot() {
  return false;
}

export function useHydrated() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
