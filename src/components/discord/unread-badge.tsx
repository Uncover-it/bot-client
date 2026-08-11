"use client";

import { useRealtimeStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Unread count for one channel. Mentions read louder than plain messages, so
 * they get the brand colour and everything else stays quiet.
 */
export function UnreadBadge({
  channelId,
  className,
}: {
  channelId: string;
  className?: string;
}) {
  const count = useRealtimeStore((s) => s.unread.get(channelId) ?? 0);
  const mention = useRealtimeStore((s) => s.unreadMentions.has(channelId));

  if (count === 0) return null;

  return (
    <span
      className={cn(
        "ml-auto shrink-0 min-w-4 h-4 px-1 rounded-full grid place-items-center text-[10px] font-mono font-semibold tabular-nums",
        mention
          ? "bg-brand text-brand-foreground"
          : "bg-muted-foreground/25 text-foreground",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
      <span className="sr-only">
        {` unread${mention ? ", mentions the bot" : ""}`}
      </span>
    </span>
  );
}
