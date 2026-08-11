"use client";

import { useEffect } from "react";
import { useRealtimeStore } from "@/lib/store";
import { useGateway } from "@/hooks/use-gateway";
import type { User } from "@/lib/discord/types";

interface Props {
  initialUser?: User | null;
  initialToken: string;
  children: React.ReactNode;
}

export function GatewayProvider({
  initialUser,
  initialToken,
  children,
}: Props) {
  useGateway(initialToken, initialUser?.id ?? null);
  const setUser = useRealtimeStore((s) => s.setUser);

  useEffect(() => {
    if (initialUser) setUser(initialUser);
  }, [initialUser, setUser]);

  return children;
}
