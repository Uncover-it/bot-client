"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, MessageSquareText, Hash, FileImage } from "lucide-react";
import Link from "next/link";
import { getActiveThreads } from "@/api/data/actions";
import type { Channel } from "@/lib/discord/types";
import { CHANNEL_TYPE } from "@/lib/discord/constants";

interface Props {
  guildId: string;
  channel: Channel;
}

interface ActiveThreadsRes {
  threads?: Channel[];
  members?: unknown[];
}

interface FetchState {
  channelId: string;
  threads: Channel[] | null;
  error: string | null;
}

export function ForumView({ guildId, channel }: Props) {
  const [data, setData] = useState<FetchState>({
    channelId: channel.id,
    threads: null,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res: ActiveThreadsRes = await getActiveThreads(guildId);
        if (!alive) return;
        const filtered = (res?.threads ?? []).filter(
          (t) => t.parent_id === channel.id,
        );
        setData({ channelId: channel.id, threads: filtered, error: null });
      } catch {
        if (alive)
          setData({ channelId: channel.id, threads: [], error: "Failed to load threads" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [guildId, channel.id]);

  const stale = data.channelId !== channel.id;
  const threads = stale ? null : data.threads;
  const error = stale ? null : data.error;

  const isMedia = channel.type === CHANNEL_TYPE.GUILD_MEDIA;
  const tags = channel.available_tags ?? [];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 md:p-6 min-w-0">
      <div className="max-w-3xl mx-auto space-y-4 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {isMedia ? (
            <FileImage className="size-5 text-muted-foreground" />
          ) : (
            <MessageSquareText className="size-5 text-muted-foreground" />
          )}
          <h1 className="text-xl font-semibold truncate">{channel.name}</h1>
          <span className="text-xs text-muted-foreground font-mono shrink-0">
            {isMedia ? "Media" : "Forum"}
          </span>
        </div>
        {channel.topic && (
          <p className="text-sm text-muted-foreground border-l-2 border-border pl-3 [overflow-wrap:anywhere] whitespace-pre-wrap">
            {channel.topic}
          </p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t.id}
                className="px-2 py-0.5 rounded-full text-[11px] border bg-muted/30"
              >
                {t.emoji_name ? `${t.emoji_name} ` : ""}
                {t.name}
              </span>
            ))}
          </div>
        )}

        <div className="border-t pt-4">
          <h2 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-muted-foreground mb-3">
            Active threads
          </h2>
          {threads === null && !error && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <LoaderCircle className="size-4 animate-spin" /> Loading threads…
            </div>
          )}
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}
          {threads !== null && threads.length === 0 && !error && (
            <p className="text-sm text-muted-foreground py-6">No active threads.</p>
          )}
          {threads !== null && threads.length > 0 && (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {threads.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/dashboard/servers/${guildId}/channels/${t.id}`}
                    className="block rounded-lg border bg-card hover:bg-accent/40 transition-colors p-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Hash className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm truncate">{t.name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-mono">
                      {typeof t.message_count === "number" && (
                        <span>{t.message_count} msgs</span>
                      )}
                      {typeof t.member_count === "number" && (
                        <span>{t.member_count} members</span>
                      )}
                      {t.applied_tags && t.applied_tags.length > 0 && (
                        <span className="truncate">
                          {t.applied_tags
                            .map((id) => tags.find((tt) => tt.id === id)?.name)
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
