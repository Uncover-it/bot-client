"use client";

import { useEffect, useState } from "react";
import { AtSign, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DiscordAvatar } from "@/components/ui/discord-avatar";
import { MessageList } from "@/components/discord/message-list";
import {
  MessageInput,
  type ReplyTarget,
} from "@/components/discord/message-input";
import { StatusBar } from "@/components/discord/status-bar";
import { useRealtimeStore } from "@/lib/store";
import { getChannel } from "@/api/data/actions";
import { avatarUrl } from "@/lib/discord/cdn";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import type { Channel } from "@/lib/discord/types";

interface Props {
  channelId: string;
}

export function DmView({ channelId }: Props) {
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  useKeyboardInset();

  const dm = useRealtimeStore((s) => s.dms.get(channelId));
  const upsertDm = useRealtimeStore((s) => s.upsertDm);
  const removeDm = useRealtimeStore((s) => s.removeDm);

  // Arriving by URL or after a cache clear, the recipient is unknown until
  // the channel is fetched.
  useEffect(() => {
    if (dm?.recipients?.length) return;
    let alive = true;
    (async () => {
      try {
        const data: Channel | null = await getChannel(channelId);
        if (alive && data?.id) upsertDm(data);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [channelId, dm?.recipients?.length, upsertDm]);

  const recipient = dm?.recipients?.[0];
  const name = recipient
    ? (recipient.global_name ?? recipient.username)
    : "Direct message";
  const avatar = recipient
    ? avatarUrl(recipient.id, recipient.avatar)
    : "/discord.svg";

  return (
    <div
      className="flex w-full overflow-hidden"
      style={{ height: "calc(100dvh - var(--kb, 0px))" }}
    >
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-12 shrink-0 border-b flex items-center pl-12 pr-2 md:pr-4 gap-2 md:gap-3 bg-background/80 backdrop-blur-sm min-w-0">
          <DiscordAvatar src={avatar} alt={name} size={24} />
          <span className="font-semibold truncate min-w-0">{name}</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground border rounded px-1.5 py-0.5 shrink-0 hidden sm:inline">
            Direct
          </span>
          <div className="flex-1" />
          <StatusBar />
          {recipient && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(recipient.id);
                    toast.success("Copied user ID");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy user ID</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  removeDm(channelId);
                  toast.success("Removed from your DM list", {
                    description: "The conversation itself is untouched.",
                  });
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove from list</TooltipContent>
          </Tooltip>
        </header>

        <MessageList
          channelId={channelId}
          onReply={setReply}
          emptyState={
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <DiscordAvatar src={avatar} alt={name} size={64} />
              <div>
                <h2 className="font-semibold text-lg">{name}</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  This is the start of your direct message history. Anything you
                  send here goes straight to {name}.
                </p>
              </div>
              {recipient && (
                <span className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground">
                  <AtSign className="size-3" />
                  {recipient.username}
                </span>
              )}
            </div>
          }
        />
        <footer className="shrink-0 p-2 md:p-3 pt-3 pb-safe md:pb-3 border-t">
          <MessageInput
            channelId={channelId}
            reply={reply}
            onClearReply={() => setReply(null)}
          />
        </footer>
      </main>
    </div>
  );
}
