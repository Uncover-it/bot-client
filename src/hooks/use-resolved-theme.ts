"use client";

import { useTheme } from "next-themes";
import { useHydrated } from "@/hooks/use-hydrated";

export function useResolvedTheme(): "light" | "dark" {
  const { resolvedTheme } = useTheme();
  const hydrated = useHydrated();
  if (!hydrated) return "dark";
  return resolvedTheme === "light" ? "light" : "dark";
}
