"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};
const trueSnapshot = () => true;
const falseSnapshot = () => false;

export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, trueSnapshot, falseSnapshot);
}
