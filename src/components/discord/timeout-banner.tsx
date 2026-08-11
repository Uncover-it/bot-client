"use client";

import { TimerOff } from "lucide-react";
import { formatCountdown, useSelfTimeout } from "@/hooks/use-self-timeout";

/**
 * Shown across the top of a channel while the bot is under a timeout in that
 * server. Discord silently rejects sends in this state, so the countdown is
 * the difference between "nothing is happening" and "here is when it ends".
 */
export function TimeoutBanner({ guildId }: { guildId: string | undefined }) {
  const timeout = useSelfTimeout(guildId, { fetch: true });
  if (!timeout.active || !timeout.until) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs border-b border-destructive/30 bg-destructive/10 text-destructive">
      <TimerOff className="size-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-medium">
          The bot is timed out in this server.
        </span>{" "}
        <span className="text-destructive/80">
          It cannot send messages, add reactions, or join voice until the
          timeout lifts. A moderator can remove it early.
        </span>
      </div>
      <span
        className="shrink-0 font-mono tabular-nums font-semibold"
        title={`Ends ${timeout.until.toLocaleString()}`}
      >
        {formatCountdown(timeout.msLeft)}
      </span>
    </div>
  );
}
