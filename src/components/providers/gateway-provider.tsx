"use client";

import { useEffect, useState } from "react";
import { useRealtimeStore } from "@/lib/store";
import { useGateway } from "@/hooks/use-gateway";
import { pingRest } from "@/api/data/actions";
import { getSessionToken } from "@/api/session/actions";
import type { User } from "@/lib/discord/types";

interface Props {
  initialUser?: User | null;
  children: React.ReactNode;
}

export function GatewayProvider({ initialUser, children }: Props) {
  const [token, setToken] = useState<string | null>(null);
  useGateway(token);
  const setUser = useRealtimeStore((s) => s.setUser);
  const setRest = useRealtimeStore((s) => s.setRestPing);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const t = await getSessionToken();
        if (alive && t) setToken(t);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

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
