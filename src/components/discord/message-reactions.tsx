"use client";

import { useState } from "react";
import Image from "next/image";
import { SmilePlus, Users } from "lucide-react";
import Spinner from "@/components/ui/spinner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmojiPickerPro } from "@/components/discord/emoji-picker-pro";
import {
  ReactionDetailsDialog,
  ReactionTooltipBody,
} from "@/components/discord/reaction-viewer";
import { addReaction, removeReaction } from "@/api/data/actions";
import { emojiUrl } from "@/lib/discord/cdn";
import {
  type EmojiRef,
  parseEmojiToken,
  reactionApiKey,
  reactionKey,
} from "@/lib/discord/emoji";
import { useRealtimeStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Reaction } from "@/lib/discord/types";

interface Props {
  /** Absent in a DM. */
  guildId?: string;
  channelId: string;
  messageId: string;
  reactions?: Reaction[];
  /**
   * Resolved once by the message list rather than per row: every pill on
   * screen asking the permission hook itself was the expensive version.
   */
  canReact: boolean;
  canManage?: boolean;
}

export function MessageReactions({
  guildId,
  channelId,
  messageId,
  reactions,
  canReact,
  canManage,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const addStore = useRealtimeStore((s) => s.addReaction);
  const removeStore = useRealtimeStore((s) => s.removeReaction);
  const markPending = useRealtimeStore((s) => s.markReactionPending);
  const list = reactions ?? [];

  async function apply(emoji: EmojiRef, add: boolean) {
    const key = reactionApiKey(emoji);
    if (!key) return;
    const optimistic = add ? addStore : removeStore;
    const rollback = add ? removeStore : addStore;
    optimistic(channelId, messageId, emoji, true);
    markPending(channelId, messageId, emoji, true);
    try {
      if (add) await addReaction(channelId, messageId, key);
      else await removeReaction(channelId, messageId, key);
    } catch (e) {
      rollback(channelId, messageId, emoji, true);
      toast.error(
        e instanceof Error
          ? e.message
          : add
            ? "Failed to add reaction"
            : "Failed to remove reaction",
      );
    } finally {
      markPending(channelId, messageId, emoji, false);
    }
  }

  function toggle(r: Reaction) {
    if (!r.me && !canReact) {
      toast.error("Bot lacks Add Reactions permission");
      return;
    }
    apply(r.emoji, !r.me);
  }

  function addFromPicker(token: string) {
    setPickerOpen(false);
    if (!canReact) {
      toast.error("Bot lacks Add Reactions permission");
      return;
    }
    apply(parseEmojiToken(token).emoji, true);
  }

  if (list.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {list.map((r) => {
        const isPending = !!r.__pending;
        return (
          <Tooltip key={reactionKey(r.emoji)} delayDuration={350}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => toggle(r)}
                disabled={isPending}
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-xs transition-colors",
                  r.me
                    ? "border-brand/60 bg-brand/15 text-foreground"
                    : "border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground",
                  isPending && "opacity-70",
                )}
                aria-label={`${r.count} reacted with ${r.emoji.name ?? "emoji"}`}
              >
                {r.emoji.id ? (
                  <Image
                    src={emojiUrl(r.emoji.id, !!r.emoji.animated)}
                    alt={r.emoji.name ?? ""}
                    width={16}
                    height={16}
                    unoptimized
                  />
                ) : (
                  <span className="leading-none text-base">{r.emoji.name}</span>
                )}
                <span className="font-mono text-[10px] tabular-nums">
                  {r.count}
                </span>
                {isPending && <Spinner size={10} className="ml-0.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-72">
              <ReactionTooltipBody
                guildId={guildId}
                channelId={channelId}
                messageId={messageId}
                reaction={r}
              />
            </TooltipContent>
          </Tooltip>
        );
      })}

      {canReact && (
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center px-1.5 py-1 rounded-md border border-dashed border-border bg-transparent hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
              title="Add reaction"
              aria-label="Add reaction"
            >
              <SmilePlus className="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-fit p-0" align="start">
            <EmojiPickerPro guildId={guildId} onSelect={addFromPicker} />
          </PopoverContent>
        </Popover>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="inline-flex items-center px-1.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-opacity md:opacity-0 md:group-hover/msg:opacity-100 md:focus-visible:opacity-100"
            aria-label="See who reacted"
          >
            <Users className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">See who reacted</TooltipContent>
      </Tooltip>

      {detailsOpen && (
        <ReactionDetailsDialog
          guildId={guildId}
          channelId={channelId}
          messageId={messageId}
          reactions={list}
          canManage={canManage}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      )}
    </div>
  );
}
