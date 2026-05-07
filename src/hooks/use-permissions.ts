"use client";

import { useMemo } from "react";
import { useRealtimeStore } from "@/lib/store";
import {
  can,
  computeChannelPermissions,
  effectiveGuildPermissions,
} from "@/lib/discord/permissions";
import type { PERMISSIONS } from "@/lib/discord/constants";

export function useGuildPermissions(guildId: string | undefined): bigint {
  const guild = useRealtimeStore((s) => (guildId ? s.guilds.get(guildId) : undefined));
  return useMemo(() => effectiveGuildPermissions(guild), [guild]);
}

export function useChannelPermissions(
  guildId: string | undefined,
  channelId: string | undefined,
): bigint {
  const guild = useRealtimeStore((s) => (guildId ? s.guilds.get(guildId) : undefined));
  const user = useRealtimeStore((s) => s.user);
  const members = useRealtimeStore((s) => (guildId ? s.members.get(guildId) : undefined));

  return useMemo(() => {
    const base = effectiveGuildPermissions(guild);
    if (!channelId) return base;
    const ch = guild?.channels?.find((c) => c.id === channelId);
    const botMember = members?.find((m) => m.user?.id === user?.id);
    return computeChannelPermissions(base, ch, botMember?.roles ?? [], user?.id, guildId);
  }, [guild, channelId, members, user, guildId]);
}

export function useCan(
  guildId: string | undefined,
  perm: keyof typeof PERMISSIONS,
  channelId?: string,
): boolean {
  const perms = useChannelPermissions(guildId, channelId);
  return useMemo(() => can(perms, perm), [perms, perm]);
}
