"use client";

import { useEffect } from "react";
import { useRealtimeStore } from "@/lib/store";
import { useGateway } from "@/hooks/use-gateway";
import { pingRest } from "@/api/data/actions";
import type { User } from "@/lib/discord/types";

interface Props {
  token: string | null;
  initialUser?: User | null;
  children: React.ReactNode;
}

export function GatewayProvider({ token, initialUser, children }: Props) {
  useGateway(token);
  const setUser = useRealtimeStore((s) => s.setUser);
  const setRest = useRealtimeStore((s) => s.setRestPing);

  useEffect(() => {
    if (initialUser) setUser(initialUser);
  }, [initialUser, setUser]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const ms = await pingRest();
        if (alive) setRest(ms);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [setRest]);

  return children;
}
