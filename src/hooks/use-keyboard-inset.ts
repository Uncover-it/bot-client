"use client";

import { useEffect } from "react";

export function useKeyboardInset() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const apply = () => {
      const offset = window.innerHeight - vv.height - vv.offsetTop;
      root.style.setProperty("--kb", `${Math.max(0, Math.round(offset))}px`);
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      root.style.removeProperty("--kb");
    };
  }, []);
}
