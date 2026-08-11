"use client";

import { useMemo } from "react";
import { useRealtimeStore } from "@/lib/store";
import {
  computeChannelPermissions,
  effectiveGuildPermissions,
} from "@/lib/discord/permissions";
import { DM_PERMISSIONS } from "@/lib/discord/constants";

export function useGuildPermissions(guildId: string | undefined): bigint {
  const guild = useRealtimeStore((s) =>
    guildId ? s.guilds.get(guildId) : undefined,
  );
  return useMemo(() => effectiveGuildPermissions(guild), [guild]);
}

/**
 * Resolves what the bot can do in one channel. With no guild the channel is a
 * DM, which has a fixed permission set and no overwrites to resolve.
 */
export function useChannelPermissions(
  guildId: string | undefined,
  channelId: string | undefined,
): bigint {
  const guild = useRealtimeStore((s) =>
    guildId ? s.guilds.get(guildId) : undefined,
  );
  const selfId = useRealtimeStore((s) => s.user?.id);
  // Reading only the bot's own member keeps this off the hot path: a member
  // chunk for 900 other people no longer invalidates every permission check
  // on screen.
  const selfRoles = useRealtimeStore((s) =>
    guildId ? s.selfMembers.get(guildId)?.roles : undefined,
  );

  return useMemo(() => {
    if (!guildId) return DM_PERMISSIONS;
    const base = effectiveGuildPermissions(guild);
    if (!channelId) return base;
    const ch = guild?.channels?.find((c) => c.id === channelId);
    return computeChannelPermissions(
      base,
      ch,
      selfRoles ?? [],
      selfId,
      guildId,
    );
  }, [guild, channelId, selfRoles, selfId, guildId]);
}
