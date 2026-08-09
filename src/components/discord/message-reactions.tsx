"use client";

import { useState } from "react";
import Image from "next/image";
import { SmilePlus } from "lucide-react";
import Spinner from "@/components/ui/spinner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmojiPickerPro } from "@/components/discord/emoji-picker-pro";
import { addReaction, removeReaction } from "@/api/data/actions";
import { emojiUrl } from "@/lib/discord/cdn";
import { useRealtimeStore } from "@/lib/store";
import { useChannelPermissions } from "@/hooks/use-permissions";
import { can } from "@/lib/discord/permissions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Reaction } from "@/lib/discord/types";

interface Props {
  guildId: string;
  channelId: string;
  messageId: string;
  reactions?: Reaction[];
}

function reactionApiKey(emoji: {
  id?: string | null;
  name?: string | null;
}): string | null {
  if (emoji.id && emoji.name) return `${emoji.name}:${emoji.id}`;
  if (emoji.name) return emoji.name;
  return null;
}

export function MessageReactions({
  guildId,
  channelId,
  messageId,
  reactions,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addStore = useRealtimeStore((s) => s.addReaction);
  const removeStore = useRealtimeStore((s) => s.removeReaction);
  const markPending = useRealtimeStore((s) => s.markReactionPending);
  const perms = useChannelPermissions(guildId, channelId);
  const canReact = can(perms, "Add Reactions");
  const list = reactions ?? [];

  async function toggle(r: Reaction) {
    const key = reactionApiKey(r.emoji);
    if (!key) return;
    if (r.me) {
      markPending(channelId, messageId, r.emoji, true);
      removeStore(channelId, messageId, r.emoji, true);
      try {
        await removeReaction(channelId, messageId, key);
      } catch (e) {
        addStore(channelId, messageId, r.emoji, true);
        toast.error(
          e instanceof Error ? e.message : "Failed to remove reaction",
        );
      } finally {
        markPending(channelId, messageId, r.emoji, false);
      }
    } else {
      if (!canReact) {
        toast.error("Bot lacks Add Reactions permission");
        return;
      }
      addStore(channelId, messageId, r.emoji, true);
      markPending(channelId, messageId, r.emoji, true);
      try {
        await addReaction(channelId, messageId, key);
      } catch (e) {
        removeStore(channelId, messageId, r.emoji, true);
        toast.error(e instanceof Error ? e.message : "Failed to add reaction");
      } finally {
        markPending(channelId, messageId, r.emoji, false);
      }
    }
  }

  async function addFromPicker(token: string) {
    setPickerOpen(false);
    if (!canReact) {
      toast.error("Bot lacks Add Reactions permission");
      return;
    }
    const m = token.match(/^<(a)?:([\w~]+):(\d+)>$/);
    let key: string;
    let emoji: { id?: string | null; name?: string | null; animated?: boolean };
    if (m) {
      key = `${m[2]}:${m[3]}`;
      emoji = { id: m[3], name: m[2], animated: !!m[1] };
    } else {
      key = token;
      emoji = { id: null, name: token };
    }
    addStore(channelId, messageId, emoji, true);
    markPending(channelId, messageId, emoji, true);
    try {
      await addReaction(channelId, messageId, key);
    } catch (e) {
      removeStore(channelId, messageId, emoji, true);
      toast.error(e instanceof Error ? e.message : "Failed to add reaction");
    } finally {
      markPending(channelId, messageId, emoji, false);
    }
  }

  if (list.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {list.map((r, i) => {
        const isCustom = !!r.emoji.id;
        const isPending = !!r.__pending;
        return (
          <button
            key={`${r.emoji.id ?? r.emoji.name ?? i}`}
            type="button"
            onClick={() => toggle(r)}
            disabled={isPending}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-xs transition-colors",
              r.me
                ? "border-primary/60 bg-primary/15 text-foreground"
                : "border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground",
              isPending && "opacity-70",
            )}
            title={r.emoji.name ?? ""}
          >
            {isCustom ? (
              <Image
                src={emojiUrl(r.emoji.id!, !!r.emoji.animated)}
                alt={r.emoji.name ?? ""}
                width={16}
                height={16}
                unoptimized
              />
            ) : (
              <span className="leading-none text-base">{r.emoji.name}</span>
            )}
            <span className="font-mono text-[10px]">{r.count}</span>
            {isPending && <Spinner size={10} className="ml-0.5" />}
          </button>
        );
      })}
      {canReact && (
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-dashed border-border bg-transparent hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
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
    </div>
  );
}
