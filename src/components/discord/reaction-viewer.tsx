"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import Spinner from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DiscordAvatar } from "@/components/ui/discord-avatar";
import { clearReactionEmoji, getReactionUsers } from "@/api/data/actions";
import { avatarUrl, emojiUrl } from "@/lib/discord/cdn";
import {
  type EmojiRef,
  reactionApiKey,
  reactionKey,
} from "@/lib/discord/emoji";
import { useRealtimeStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Reaction, User } from "@/lib/discord/types";

const PAGE = 25;

/**
 * One reaction's user list, cached across every place that asks for it: the
 * hover tooltip and the dialog read the same entry, so opening the dialog
 * after a hover costs nothing.
 */
const cache = new Map<string, User[]>();

function cacheKey(messageId: string, emoji: EmojiRef): string {
  return `${messageId}:${reactionKey(emoji)}`;
}

function useReactors(
  channelId: string,
  messageId: string,
  emoji: EmojiRef | null,
  enabled: boolean,
) {
  const key = emoji ? cacheKey(messageId, emoji) : "";
  const [users, setUsers] = useState<User[] | null>(
    () => cache.get(key) ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    setUsers(cache.get(key) ?? null);
    setError(null);
    setExhausted(false);
  }, [key]);

  const load = useCallback(
    async (after?: string) => {
      if (!emoji) return;
      const api = reactionApiKey(emoji);
      if (!api) return;
      setLoading(true);
      setError(null);
      try {
        const page: User[] = await getReactionUsers(channelId, messageId, api, {
          limit: PAGE,
          after,
        });
        const merged = after ? [...(cache.get(key) ?? []), ...page] : page;
        cache.set(key, merged);
        setUsers(merged);
        if (page.length < PAGE) setExhausted(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load reactions");
      } finally {
        setLoading(false);
      }
    },
    [channelId, messageId, emoji, key],
  );

  useEffect(() => {
    if (!enabled || !emoji) return;
    if (cache.has(key)) return;
    load();
  }, [enabled, emoji, key, load]);

  return { users, loading, error, exhausted, load };
}

function EmojiGlyph({ emoji, size = 16 }: { emoji: EmojiRef; size?: number }) {
  if (emoji.id) {
    return (
      <Image
        src={emojiUrl(emoji.id, !!emoji.animated)}
        alt={emoji.name ?? ""}
        width={size}
        height={size}
        unoptimized
        className="shrink-0"
      />
    );
  }
  return (
    <span className="leading-none shrink-0" style={{ fontSize: size }}>
      {emoji.name}
    </span>
  );
}

/** Resolves a reactor to the name the rest of the UI would show. */
function useDisplayName(guildId: string | undefined) {
  const members = useRealtimeStore((s) =>
    guildId ? s.members.get(guildId) : undefined,
  );
  return useCallback(
    (u: User) =>
      members?.find((m) => m.user?.id === u.id)?.nick ??
      u.global_name ??
      u.username,
    [members],
  );
}

interface TooltipProps {
  guildId?: string;
  channelId: string;
  messageId: string;
  reaction: Reaction;
}

/**
 * Contents of the hover tooltip on a reaction pill. Radix only mounts tooltip
 * content while it is open, so the fetch below is genuinely lazy: hovering is
 * what asks Discord who reacted.
 */
export function ReactionTooltipBody({
  guildId,
  channelId,
  messageId,
  reaction,
}: TooltipProps) {
  const { users, loading, error } = useReactors(
    channelId,
    messageId,
    reaction.emoji,
    true,
  );
  const nameOf = useDisplayName(guildId);
  const label = reaction.emoji.id
    ? `:${reaction.emoji.name}:`
    : (reaction.emoji.name ?? "");

  if (error) {
    return <span className="text-destructive">{error}</span>;
  }
  if (loading && !users) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Spinner size={11} /> Loading reactors
      </span>
    );
  }
  if (!users?.length) {
    return <span>Reacted with {label}</span>;
  }

  const shown = users.slice(0, 3).map(nameOf);
  const rest = reaction.count - shown.length;
  const who =
    rest > 0
      ? `${shown.join(", ")} and ${rest} ${rest === 1 ? "other" : "others"}`
      : shown.length > 1
        ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`
        : shown[0];

  return (
    <span className="flex items-center gap-2 max-w-64">
      <span className="flex -space-x-1.5 shrink-0">
        {users.slice(0, 4).map((u) => (
          <DiscordAvatar
            key={u.id}
            src={avatarUrl(u.id, u.avatar)}
            alt={u.username}
            size={16}
            className="ring-1 ring-popover rounded-full"
          />
        ))}
      </span>
      <span className="min-w-0">
        <span className="font-medium">{who}</span> reacted with {label}
      </span>
    </span>
  );
}

interface DialogProps {
  guildId?: string;
  channelId: string;
  messageId: string;
  reactions: Reaction[];
  canManage?: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * Full reactor list, one tab per emoji. This is the answer to "who reacted",
 * where the tooltip is only the preview.
 */
export function ReactionDetailsDialog({
  guildId,
  channelId,
  messageId,
  reactions,
  canManage,
  open,
  onOpenChange,
}: DialogProps) {
  const [activeKey, setActiveKey] = useState(() =>
    reactions[0] ? reactionKey(reactions[0].emoji) : "",
  );
  // The selected emoji can vanish while the dialog is open (someone removed
  // the last one), so fall back to whatever is still there.
  const active =
    reactions.find((r) => reactionKey(r.emoji) === activeKey) ?? reactions[0];
  const activeEmojiKey = active ? reactionKey(active.emoji) : "";
  const { users, loading, error, exhausted, load } = useReactors(
    channelId,
    messageId,
    active?.emoji ?? null,
    open,
  );
  const nameOf = useDisplayName(guildId);
  const removeEmoji = useRealtimeStore((s) => s.removeReactionEmoji);

  const total = reactions.reduce((n, r) => n + r.count, 0);

  function clearAll() {
    if (!active) return;
    const api = reactionApiKey(active.emoji);
    if (!api) return;
    const emoji = active.emoji;
    toast.promise(
      clearReactionEmoji(channelId, messageId, api).then(() => {
        removeEmoji(channelId, messageId, emoji);
        cache.delete(cacheKey(messageId, emoji));
        onOpenChange(false);
      }),
      {
        loading: "Removing reactions",
        success: "Reactions removed",
        error: (e) => `Error: ${e.message}`,
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b">
          <DialogTitle className="text-base">Reactions</DialogTitle>
          <DialogDescription>
            {total} {total === 1 ? "reaction" : "reactions"} across{" "}
            {reactions.length} {reactions.length === 1 ? "emoji" : "emoji"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-64 max-h-[60vh]">
          <div className="w-32 shrink-0 border-r overflow-y-auto p-1.5 space-y-0.5">
            {reactions.map((r) => {
              const key = reactionKey(r.emoji);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveKey(key)}
                  aria-pressed={key === activeEmojiKey}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                    key === activeEmojiKey
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <EmojiGlyph emoji={r.emoji} />
                  <span className="font-mono text-xs">{r.count}</span>
                  {r.me && (
                    <span className="ml-auto size-1.5 rounded-full bg-brand" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex-1 min-w-0 overflow-y-auto p-2">
            {error && (
              <p className="px-2 py-3 text-xs text-destructive">{error}</p>
            )}
            {loading && !users && (
              <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                <Spinner size={13} /> Loading reactors
              </div>
            )}
            {users?.length === 0 && !loading && (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                No one reacted with this any more.
              </p>
            )}
            {users?.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50"
              >
                <DiscordAvatar
                  src={avatarUrl(u.id, u.avatar)}
                  alt={u.username}
                  size={28}
                />
                <div className="min-w-0">
                  <div className="text-sm truncate">{nameOf(u)}</div>
                  <div className="text-[11px] font-mono text-muted-foreground truncate">
                    @{u.username}
                  </div>
                </div>
                {u.bot && (
                  <span className="ml-auto px-1 rounded bg-blue-500 text-white text-[8px] font-bold">
                    BOT
                  </span>
                )}
              </div>
            ))}
            {users && !exhausted && (
              <button
                type="button"
                disabled={loading}
                onClick={() => load(users[users.length - 1]?.id)}
                className="w-full py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {loading ? "Loading" : "Load more"}
              </button>
            )}
          </div>
        </div>
        {canManage && active && (
          <div className="border-t px-4 py-2.5 flex justify-end">
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 text-xs text-destructive hover:underline underline-offset-2"
            >
              <Trash2 className="size-3.5" />
              Remove all{" "}
              {active.emoji.id ? `:${active.emoji.name}:` : active.emoji.name}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
