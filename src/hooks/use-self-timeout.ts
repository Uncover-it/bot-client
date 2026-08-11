"use client";

import { useEffect, useState } from "react";
import { useRealtimeStore } from "@/lib/store";
import { getGuildMember } from "@/api/data/actions";

export interface SelfTimeout {
  /** When the timeout lifts, or null when the bot is not timed out. */
  until: Date | null;
  active: boolean;
  /** Milliseconds left, recomputed once a second while active. */
  msLeft: number;
}

const IDLE: SelfTimeout = { until: null, active: false, msLeft: 0 };

/**
 * Whether the bot itself is under a timeout in this guild, with a live
 * countdown. Discord enforces this server-side, so the composer has to reflect
 * it or every send just 403s.
 */
export function useSelfTimeout(
  guildId: string | undefined,
  options?: {
    /**
     * Fetch the bot's own member when the store has not seen it yet. Off for
     * ambient indicators like the sidebar, which would otherwise fire one
     * request per guild on load; those rely on GUILD_MEMBER_UPDATE instead.
     */
    fetch?: boolean;
  },
): SelfTimeout {
  const shouldFetch = options?.fetch ?? false;
  const selfId = useRealtimeStore((s) => s.user?.id);
  const until = useRealtimeStore((s) =>
    guildId ? s.selfMembers.get(guildId)?.communication_disabled_until : null,
  );
  const hasSelfMember = useRealtimeStore((s) =>
    guildId ? s.selfMembers.has(guildId) : false,
  );
  const upsertMember = useRealtimeStore((s) => s.upsertMember);
  const [now, setNow] = useState(() => Date.now());

  // GUILD_MEMBER_UPDATE keeps this fresh afterwards, but the bot's own member
  // is not in any chunk the client asks for, so fetch it once per guild.
  useEffect(() => {
    if (!shouldFetch || !guildId || !selfId || hasSelfMember) return;
    let alive = true;
    (async () => {
      try {
        const m = await getGuildMember(guildId, selfId);
        if (alive && m?.user?.id) upsertMember(guildId, m);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [shouldFetch, guildId, selfId, hasSelfMember, upsertMember]);

  const endsAt = until ? new Date(until).getTime() : 0;

  // Only tick while there is something to count down. An expired or absent
  // timeout leaves no interval running.
  useEffect(() => {
    if (!endsAt || endsAt <= Date.now()) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!endsAt) return IDLE;
  const msLeft = endsAt - now;
  if (msLeft <= 0) return IDLE;
  return { until: new Date(endsAt), active: true, msLeft };
}

/** "4m 12s" / "1h 03m" / "2d 4h", tuned for a countdown that has to fit inline. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600) % 24;
  const d = Math.floor(total / 86400);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}
