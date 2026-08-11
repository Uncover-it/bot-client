"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Spinner from "../ui/spinner";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  useChannelPermissions,
  useGuildPermissions,
} from "@/hooks/use-permissions";
import { can } from "@/lib/discord/permissions";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import {
  addReaction,
  ban,
  deleteMessage,
  editMessage,
  getMessages,
  kick,
  pinMessage,
  setTimeout as serverTimeout,
  unpinMessage,
} from "@/api/data/actions";
import {
  ClockPlus,
  Copy,
  ExternalLink,
  IdCard,
  Pencil,
  Trash2,
  Pin,
  PinOff,
  UserRoundMinus,
  Ban,
  Reply,
  MoreHorizontal,
  MessageSquare,
  SmilePlus,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmojiPickerPro } from "@/components/discord/emoji-picker-pro";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import {
  CopyID,
  CopyMessage,
  CopyUsername,
} from "@/components/contextMenuHandellers";
import { MessageItem } from "@/components/discord/message";
import { UserProfilePopover } from "@/components/discord/user-profile-popover";
import { IntentBanner } from "@/components/discord/intent-warning";
import { useRealtimeStore } from "@/lib/store";
import { useOpenDm } from "@/hooks/use-open-dm";
import { parseEmojiToken } from "@/lib/discord/emoji";
import type { GuildMember, Message } from "@/lib/discord/types";
import type { ReplyTarget } from "@/components/discord/message-input";
import { DiscordAvatar } from "@/components/ui/discord-avatar";
import { avatarUrl } from "@/lib/discord/cdn";

// An optimistic message carries a client-generated id until Discord echoes the
// real one back, and a failed send keeps that fake id for good. Any REST call
// keyed on it would 404, so gate id-based actions on this.
function isSent(msg: Message): boolean {
  return !msg.__pending && !msg.__failed;
}

/** True when `m` is the first message of a calendar day in this list. */
function startsNewDay(prev: Message | undefined, m: Message): boolean {
  if (!prev) return false;
  return (
    new Date(prev.timestamp).toDateString() !==
    new Date(m.timestamp).toDateString()
  );
}

const DAY_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
};

function DayDivider({ timestamp }: { timestamp: string }) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const label =
    date.toDateString() === today.toDateString()
      ? "Today"
      : date.toDateString() === yesterday.toDateString()
        ? "Yesterday"
        : date.toLocaleDateString(undefined, DAY_FORMAT);
  return (
    <div className="flex items-center gap-3 px-4 pt-4 pb-1 select-none">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

interface Props {
  channelId: string;
  /** Absent in a DM. */
  serverId?: string;
  channelName?: string;
  postStarterId?: string;
  onReply: (target: ReplyTarget) => void;
  /** Rendered above the composer-facing end of the list when set. */
  emptyState?: React.ReactNode;
}

export function MessageList({
  channelId,
  serverId,
  postStarterId,
  onReply,
  emptyState,
}: Props) {
  const messages = useRealtimeStore((s) => s.messages.get(channelId));
  const roles = useRealtimeStore((s) =>
    serverId ? s.guilds.get(serverId)?.roles : undefined,
  );
  const channels = useRealtimeStore((s) =>
    serverId ? s.guilds.get(serverId)?.channels : undefined,
  );
  const typingMap = useRealtimeStore((s) => s.typing.get(channelId));
  const members = useRealtimeStore((s) =>
    serverId ? s.members.get(serverId) : undefined,
  );
  const setMessages = useRealtimeStore((s) => s.setMessages);
  const openChannel = useRealtimeStore((s) => s.openChannel);
  const prepend = useRealtimeStore((s) => s.prependMessages);
  const botUserId = useRealtimeStore((s) => s.user?.id);
  const addReactionStore = useRealtimeStore((s) => s.addReaction);
  const removeReactionStore = useRealtimeStore((s) => s.removeReaction);
  const markReactionPending = useRealtimeStore((s) => s.markReactionPending);
  const removeMessageStore = useRealtimeStore((s) => s.removeMessage);
  const perms = useChannelPermissions(serverId, channelId);
  const canManageMessages = can(perms, "Manage Messages");
  const canReact = can(perms, "Add Reactions");
  // Moderation is guild-scoped, not channel-scoped, so it does not read from
  // the channel-resolved perms above.
  const guildPerms = useGuildPermissions(serverId);
  const canKick = can(guildPerms, "Kick Members");
  const canBan = can(guildPerms, "Ban Members");
  const canTimeout = can(guildPerms, "Moderate Members");
  const guild = useMemo(
    () =>
      serverId
        ? { id: serverId, name: "", features: [], roles, channels }
        : undefined,
    [serverId, roles, channels],
  );

  const openDmWith = useOpenDm();
  const [hydrating, setHydrating] = useState(!messages);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  // Blocks pagination retries for a moment after a failure so the scroll
  // handler cannot hammer the endpoint.
  const olderRetryAt = useRef(0);
  useEffect(() => {
    atBottomRef.current = atBottom;
  }, [atBottom]);
  const updateMessageStore = useRealtimeStore((s) => s.updateMessage);

  const commitEdit = useCallback(
    async (msg: Message, nextContent: string) => {
      const prev = msg.content;
      const trimmed = nextContent.trim();
      if (trimmed === prev) {
        setEditingId(null);
        return;
      }
      updateMessageStore({
        ...msg,
        content: trimmed,
        edited_timestamp: new Date().toISOString(),
      });
      setEditingId(null);
      try {
        const res = await editMessage(channelId, msg.id, trimmed);
        if (res?.id) updateMessageStore(res);
      } catch (e) {
        updateMessageStore({ ...msg, content: prev });
        toast.error(e instanceof Error ? e.message : "Edit failed");
      }
    },
    [channelId, updateMessageStore],
  );

  const cancelEdit = useCallback(() => setEditingId(null), []);

  const reactWith = useCallback(
    async (messageId: string, token: string) => {
      const { key, emoji } = parseEmojiToken(token);
      addReactionStore(channelId, messageId, emoji, true);
      markReactionPending(channelId, messageId, emoji, true);
      try {
        await addReaction(channelId, messageId, key);
      } catch (e) {
        removeReactionStore(channelId, messageId, emoji, true);
        toast.error(e instanceof Error ? e.message : "Failed to add reaction");
      } finally {
        markReactionPending(channelId, messageId, emoji, false);
      }
    },
    [channelId, addReactionStore, markReactionPending, removeReactionStore],
  );

  const jumpTo = useCallback((id: string) => {
    const el = scrollRef.current?.querySelector(
      `[data-message-id="${id}"]`,
    ) as HTMLElement | null;
    if (!el) {
      toast.message("Message not loaded", {
        description: "Scroll up to find it.",
      });
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary", "bg-primary/10");
    setTimeout(
      () => el.classList.remove("ring-2", "ring-primary", "bg-primary/10"),
      1500,
    );
  }, []);

  useEffect(() => {
    let alive = true;
    // Registers the channel in the store's LRU and seeds its entry, so live
    // gateway messages arriving during the fetch below are kept.
    openChannel(channelId);
    const cached = useRealtimeStore.getState().messages.get(channelId);
    const hasCache = !!cached && cached.length > 0;
    setHydrating(!hasCache);
    setExhausted(false);
    if (hasCache) return;
    (async () => {
      try {
        const fresh: Message[] = await getMessages(channelId);
        if (!alive || !Array.isArray(fresh)) return;
        setMessages(channelId, fresh);
      } catch (e) {
        if (alive) {
          toast.error(
            e instanceof Error ? e.message : "Failed to load messages",
          );
        }
      } finally {
        if (alive) setHydrating(false);
      }
    })();
    return () => {
      alive = false;
      // Leaving the channel makes its incoming messages unread again.
      if (useRealtimeStore.getState().activeChannelId === channelId) {
        useRealtimeStore.getState().setActiveChannel(null);
      }
    };
  }, [channelId, setMessages, openChannel]);

  // `messages` is the trigger: this re-pins the viewport to the bottom whenever
  // the list grows, it just does not read the array itself.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deliberate re-run trigger
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || hydrating) return;
    if (atBottom) el.scrollTop = el.scrollHeight;
  }, [messages, hydrating, atBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || hydrating) return;
    const snap = () => {
      if (atBottomRef.current) el.scrollTop = el.scrollHeight;
    };
    const ro = new ResizeObserver(snap);
    ro.observe(el);
    if (innerRef.current) ro.observe(innerRef.current);
    // "load" does not bubble, but it does capture. One delegated listener
    // beats rebinding one per <img> every time a message arrives.
    el.addEventListener("load", snap, true);
    return () => {
      ro.disconnect();
      el.removeEventListener("load", snap, true);
    };
  }, [hydrating]);

  useEffect(() => {
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const fresh: Message[] = await getMessages(channelId);
        if (!Array.isArray(fresh) || !fresh.length) return;
        const state = useRealtimeStore.getState();
        const cur = state.messages.get(channelId) ?? [];
        const seen = new Set(cur.map((m) => m.id));
        const additions = fresh.filter((m) => !seen.has(m.id));
        // fresh comes newest-first from API; iterate from oldest of the gap
        // so each addMessage places newest at front correctly.
        for (let i = additions.length - 1; i >= 0; i--) {
          state.addMessage(additions[i]);
        }
      } catch {}
    };
    const onVis = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [channelId]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distanceFromBottom < 80);
    if (
      el.scrollTop < 60 &&
      !loadingOlder &&
      !exhausted &&
      messages?.length &&
      Date.now() >= olderRetryAt.current
    ) {
      loadOlder();
    }
  }

  async function loadOlder() {
    if (!messages?.length) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    try {
      const oldest = messages[messages.length - 1];
      const older: Message[] = await getMessages(channelId, oldest.id);
      if (Array.isArray(older) && older.length) {
        prepend(channelId, older);
        requestAnimationFrame(() => {
          const cur = scrollRef.current;
          if (!cur) return;
          cur.scrollTop = cur.scrollHeight - prevHeight + prevTop;
        });
      } else {
        setExhausted(true);
      }
    } catch (e) {
      // Not exhausted, just failed. Back off instead of showing "beginning of
      // channel", so a transient error does not look like the end of history.
      olderRetryAt.current = Date.now() + 5000;
      toast.error(
        e instanceof Error ? e.message : "Failed to load older messages",
      );
    } finally {
      setLoadingOlder(false);
    }
  }

  // Moderation only exists inside a guild. The controls are already hidden
  // in a DM, where guild permissions resolve to none; these guards keep the
  // types honest rather than defending against a reachable case.
  const timeoutMember = useCallback(
    (userId: string, minutes: number | null) => {
      if (!serverId) return;
      const p = async () => {
        const iso =
          minutes == null
            ? null
            : new Date(Date.now() + minutes * 60000).toISOString();
        const res = await serverTimeout(serverId, userId, iso);
        if (res.message) throw new Error(res.message);
      };
      toast.promise(p(), {
        loading: minutes == null ? "Removing timeout" : "Setting timeout",
        success: minutes == null ? "Timeout removed" : "Timeout set",
        error: (e) => `Error: ${e.message}`,
      });
    },
    [serverId],
  );

  const kickMember = useCallback(
    (userId: string) => {
      if (!serverId) return;
      if (!canKick) {
        toast.error("Bot lacks Kick Members permission");
        return;
      }
      toast.promise(kick(serverId, userId), {
        loading: "Kicking",
        success: "Kicked",
        error: (e) => `Error: ${e.message}`,
      });
    },
    [serverId, canKick],
  );

  const banMember = useCallback(
    (userId: string) => {
      if (!serverId) return;
      if (!canBan) {
        toast.error("Bot lacks Ban Members permission");
        return;
      }
      toast.promise(ban(serverId, userId), {
        loading: "Banning",
        success: "Banned",
        error: (e) => `Error: ${e.message}`,
      });
    },
    [serverId, canBan],
  );

  // Pinning is Manage Messages, same as deleting someone else's message. The
  // call sites hide the control when the bot lacks it, but re-check here so a
  // stale render cannot fire a request that is guaranteed to 403.
  const togglePin = useCallback(
    (msg: Message) => {
      if (!canManageMessages) {
        toast.error("Bot lacks Manage Messages permission");
        return;
      }
      if (!isSent(msg)) {
        toast.error("Message has not been sent yet");
        return;
      }
      const p = async () => {
        if (!msg.pinned) await pinMessage(channelId, msg.id);
        else await unpinMessage(channelId, msg.id);
      };
      toast.promise(p(), {
        loading: msg.pinned ? "Unpinning" : "Pinning",
        success: msg.pinned ? "Unpinned" : "Pinned",
        error: (e) => `Error: ${e.message}`,
      });
    },
    [channelId, canManageMessages],
  );

  const deleteMsg = useCallback(
    (msg: Message) => {
      // A failed send never reached Discord, so there is nothing to delete
      // server-side and its fake id would only 404. Dismissing it locally is
      // the only way to clear it from the list.
      if (msg.__failed) {
        removeMessageStore(channelId, msg.id);
        return;
      }
      // Still in flight: the id is not real yet either, and the send cannot be
      // recalled. Callers hide the control, so this is just a backstop.
      if (msg.__pending) return;
      if (msg.author.id !== botUserId && !canManageMessages) {
        toast.error("Bot lacks Manage Messages permission");
        return;
      }
      toast.promise(deleteMessage(channelId, msg.id), {
        loading: "Deleting",
        success: "Deleted",
        error: (e) => `Error: ${e.message}`,
      });
    },
    [channelId, canManageMessages, botUserId, removeMessageStore],
  );

  const renderHoverToolbar = useCallback(
    (msg: Message) => {
      const isMine = msg.author.id === botUserId;
      return (
        <>
          {canReact && isSent(msg) && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="size-8 md:size-6 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Add reaction"
                  aria-label="Add reaction"
                >
                  <SmilePlus className="size-4 md:size-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-fit p-0" align="end">
                <EmojiPickerPro
                  guildId={serverId}
                  onSelect={(token) => reactWith(msg.id, token)}
                />
              </PopoverContent>
            </Popover>
          )}
          <button
            type="button"
            onClick={() =>
              onReply({
                id: msg.id,
                author: msg.author.global_name ?? msg.author.username,
                content: msg.content || "[attachment]",
              })
            }
            className="size-8 md:size-6 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Reply"
            aria-label="Reply"
          >
            <Reply className="size-4 md:size-3" />
          </button>
          {isMine && isSent(msg) && (
            <button
              type="button"
              onClick={() => setEditingId(msg.id)}
              className="size-8 md:size-6 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Edit"
              aria-label="Edit"
            >
              <Pencil className="size-4 md:size-3" />
            </button>
          )}
          {canManageMessages && isSent(msg) && (
            <button
              type="button"
              onClick={() => togglePin(msg)}
              className="size-8 md:size-6 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title={msg.pinned ? "Unpin" : "Pin"}
              aria-label={msg.pinned ? "Unpin" : "Pin"}
            >
              {msg.pinned ? (
                <PinOff className="size-4 md:size-3" />
              ) : (
                <Pin className="size-4 md:size-3" />
              )}
            </button>
          )}
          {(isMine || canManageMessages) && !msg.__pending && (
            <button
              type="button"
              onClick={() => deleteMsg(msg)}
              className="size-8 md:size-6 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              title="Delete"
              aria-label="Delete"
            >
              <Trash2 className="size-4 md:size-3" />
            </button>
          )}
        </>
      );
    },
    [
      onReply,
      canManageMessages,
      togglePin,
      serverId,
      botUserId,
      reactWith,
      deleteMsg,
      canReact,
    ],
  );

  const renderMobileMenu = useCallback(
    (msg: Message) => {
      const canDelete =
        (msg.author.id === botUserId || canManageMessages) && !msg.__pending;
      const canEdit = msg.author.id === botUserId && isSent(msg);
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="size-7 grid place-items-center rounded-md bg-popover/80 backdrop-blur border text-muted-foreground hover:text-foreground hover:bg-muted shadow-sm"
              title="Actions"
              aria-label="Message actions"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-sidebar font-mono tracking-tighter"
          >
            {canReact && isSent(msg) && (
              <DropdownMenuItem onSelect={() => setReactingId(msg.id)}>
                <SmilePlus className="mr-2 size-4" /> Add reaction
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() =>
                onReply({
                  id: msg.id,
                  author: msg.author.global_name ?? msg.author.username,
                  content: msg.content || "[attachment]",
                })
              }
            >
              <Reply className="mr-2 size-4" /> Reply
            </DropdownMenuItem>
            {canEdit && (
              <DropdownMenuItem onSelect={() => setEditingId(msg.id)}>
                <Pencil className="mr-2 size-4" /> Edit
              </DropdownMenuItem>
            )}
            {canManageMessages && isSent(msg) && (
              <DropdownMenuItem onSelect={() => togglePin(msg)}>
                {msg.pinned ? (
                  <>
                    <PinOff className="mr-2 size-4" /> Unpin
                  </>
                ) : (
                  <>
                    <Pin className="mr-2 size-4" /> Pin
                  </>
                )}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() => {
                navigator.clipboard.writeText(msg.content ?? "");
                toast.success("Copied message");
              }}
            >
              <Copy className="mr-2 size-4" /> Copy text
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                navigator.clipboard.writeText(msg.id);
                toast.success("Copied ID");
              }}
            >
              <IdCard className="mr-2 size-4" /> Copy ID
            </DropdownMenuItem>
            {canDelete && (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => deleteMsg(msg)}
              >
                <Trash2 className="mr-2 size-4" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    [onReply, canManageMessages, togglePin, deleteMsg, botUserId, canReact],
  );

  const renderNameWrapper = useCallback(
    (msg: Message, children: React.ReactNode) =>
      serverId ? (
        <UserProfilePopover
          guildId={serverId}
          userId={msg.author.id}
          trigger={children}
        />
      ) : (
        children
      ),
    [serverId],
  );

  const renderAuthorMenu = useCallback(
    (msg: Message) =>
      !serverId ? (
        <DiscordAvatar
          src={avatarUrl(msg.author.id, msg.author.avatar)}
          alt={msg.author.username}
          size={36}
        />
      ) : (
        <ContextMenu>
          <UserProfilePopover
            guildId={serverId}
            userId={msg.author.id}
            trigger={
              <ContextMenuTrigger asChild>
                <button type="button">
                  <DiscordAvatar
                    src={avatarUrl(msg.author.id, msg.author.avatar)}
                    alt={msg.author.username}
                    size={36}
                  />
                </button>
              </ContextMenuTrigger>
            }
          />
          <ContextMenuContent className="bg-sidebar font-mono tracking-tighter">
            {!msg.author.bot && (canTimeout || canKick || canBan) && (
              <>
                <ContextMenuGroup>
                  {canTimeout && (
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>
                        <ClockPlus />
                        Timeout
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="bg-sidebar">
                        {[1, 5, 10, 60, 1440, 10080].map((min) => (
                          <ContextMenuItem
                            key={min}
                            onSelect={() => timeoutMember(msg.author.id, min)}
                          >
                            {min < 60
                              ? `${min} min`
                              : min < 1440
                                ? `${min / 60} hr`
                                : `${min / 1440} day`}
                          </ContextMenuItem>
                        ))}
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          variant="destructive"
                          onSelect={() => timeoutMember(msg.author.id, null)}
                        >
                          Remove timeout
                        </ContextMenuItem>
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  )}
                  {canKick && (
                    <ContextMenuItem
                      variant="destructive"
                      onSelect={() => kickMember(msg.author.id)}
                    >
                      <UserRoundMinus /> Kick
                    </ContextMenuItem>
                  )}
                  {canBan && (
                    <ContextMenuItem
                      variant="destructive"
                      onSelect={() => banMember(msg.author.id)}
                    >
                      <Ban /> Ban
                    </ContextMenuItem>
                  )}
                </ContextMenuGroup>
                <ContextMenuSeparator />
              </>
            )}
            <ContextMenuGroup>
              {!msg.author.bot && (
                <ContextMenuItem onSelect={() => openDmWith(msg.author)}>
                  <MessageSquare />
                  Message directly
                </ContextMenuItem>
              )}
              <CopyUsername username={msg.author.username} />
              <CopyID id={msg.author.id} />
              <Link
                href={`https://id.uncoverit.org?id=${msg.author.id}`}
                target="_blank"
              >
                <ContextMenuItem>
                  <ExternalLink />
                  Lookup ID
                </ContextMenuItem>
              </Link>
            </ContextMenuGroup>
          </ContextMenuContent>
        </ContextMenu>
      ),
    [
      serverId,
      timeoutMember,
      kickMember,
      banMember,
      canTimeout,
      canKick,
      canBan,
      openDmWith,
    ],
  );

  const renderContextMenu = useCallback(
    (msg: Message, children: React.ReactNode) => (
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="bg-sidebar font-mono tracking-tighter">
          <ContextMenuGroup>
            {canReact && isSent(msg) && (
              <ContextMenuItem onSelect={() => setReactingId(msg.id)}>
                <SmilePlus /> Add reaction
              </ContextMenuItem>
            )}
            <ContextMenuItem
              onSelect={() =>
                onReply({
                  id: msg.id,
                  author: msg.author.global_name ?? msg.author.username,
                  content: msg.content || "[attachment]",
                })
              }
            >
              <Reply /> Reply
            </ContextMenuItem>
            {msg.author.id === botUserId && isSent(msg) && (
              <ContextMenuItem onSelect={() => setEditingId(msg.id)}>
                <Pencil /> Edit
              </ContextMenuItem>
            )}
            {canManageMessages && isSent(msg) && (
              <ContextMenuItem onSelect={() => togglePin(msg)}>
                {!msg.pinned ? (
                  <>
                    <Pin /> Pin
                  </>
                ) : (
                  <>
                    <PinOff /> Unpin
                  </>
                )}
              </ContextMenuItem>
            )}
            {(msg.author.id === botUserId || canManageMessages) &&
              !msg.__pending && (
                <ContextMenuItem
                  variant="destructive"
                  onSelect={() => deleteMsg(msg)}
                >
                  <Trash2 /> Delete
                </ContextMenuItem>
              )}
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <CopyMessage message={msg.content} />
            <CopyID id={msg.id} />
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    ),
    [onReply, canManageMessages, togglePin, botUserId, deleteMsg, canReact],
  );

  const memberById = useMemo(() => {
    const m = new Map<string, GuildMember>();
    members?.forEach((mm) => {
      if (mm.user?.id) m.set(mm.user.id, mm);
    });
    return m;
  }, [members]);

  const typingNames = useMemo(() => {
    if (!typingMap) return [];
    const names: string[] = [];
    for (const id of typingMap.keys()) {
      if (names.length === 3) break;
      const m = memberById.get(id);
      names.push(
        m ? (m.nick ?? m.user?.global_name ?? m.user?.username ?? id) : id,
      );
    }
    return names;
  }, [typingMap, memberById]);

  // Store order is newest-first; the view renders oldest-first.
  const ordered = useMemo(
    () => (messages ? messages.slice().reverse() : []),
    [messages],
  );

  if (hydrating) {
    return (
      <div className="size-full flex items-center justify-center text-muted-foreground">
        <Spinner className="mr-2" size={16} />
        Loading messages
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <IntentBanner reason="content" />
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden min-w-0"
      >
        {loadingOlder && (
          <div className="flex justify-center my-2 text-xs text-muted-foreground">
            <Spinner className="mr-1" size={14} /> Loading older
          </div>
        )}
        {exhausted && (
          <div className="text-center py-4 text-xs text-muted-foreground">
            Beginning of channel
          </div>
        )}
        {ordered.length === 0 && emptyState}
        <div ref={innerRef}>
          {ordered.map((m, i) => {
            const prev = ordered[i - 1];
            const refAuthor = m.referenced_message?.author?.id;
            const replyToBot = !!botUserId && refAuthor === botUserId;
            const directMention =
              !!botUserId && (m.mentions ?? []).some((u) => u.id === botUserId);
            const mentionsMe =
              !!botUserId &&
              m.author.id !== botUserId &&
              (directMention || replyToBot);
            const isPostStarter = !!postStarterId && m.id === postStarterId;
            const daySplit = startsNewDay(prev, m);
            return (
              // Containment scopes layout, style and paint invalidation to the
              // row, so one arriving message does not make the browser
              // reconsider the whole list. Deliberately not
              // `content-visibility: auto`: that replaces off-screen rows with
              // a placeholder height, which would break the scroll-position
              // restore in loadOlder.
              <div key={m.id} className="[contain:layout_style_paint]">
                {daySplit && <DayDivider timestamp={m.timestamp} />}
                <MessageItem
                  message={m}
                  prev={daySplit ? undefined : prev}
                  guild={guild}
                  guildId={serverId}
                  selfUserId={botUserId}
                  storeMember={memberById.get(m.author.id)}
                  mentionsMe={mentionsMe}
                  isPostStarter={isPostStarter}
                  editing={editingId === m.id}
                  canReact={canReact}
                  canManage={canManageMessages}
                  onEditSave={commitEdit}
                  onEditCancel={cancelEdit}
                  onJumpReply={jumpTo}
                  hoverToolbar={renderHoverToolbar}
                  mobileMenu={renderMobileMenu}
                  authorMenu={renderAuthorMenu}
                  nameWrapper={renderNameWrapper}
                  rowContextMenu={renderContextMenu}
                />
                {isPostStarter && (
                  <div className="my-3 flex items-center gap-3 px-4">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Replies
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="h-2" />
      </div>
      {!atBottom && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const el = scrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          }}
          className="absolute bottom-3 right-4 shadow-md z-10"
        >
          <ChevronDown className="size-4 mr-1" /> Jump to present
        </Button>
      )}
      {reactingId && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          {/* Sibling rather than parent of the picker, so dismissing needs no
              stopPropagation and the backdrop can be a real focusable button. */}
          <button
            type="button"
            aria-label="Close emoji picker"
            className="absolute inset-0 bg-black/40 cursor-default"
            onClick={() => setReactingId(null)}
          />
          <div className="relative bg-popover border rounded-md shadow-lg max-w-[calc(100vw-2rem)]">
            <EmojiPickerPro
              guildId={serverId}
              onSelect={(token) => {
                const id = reactingId;
                setReactingId(null);
                if (id) reactWith(id, token);
              }}
            />
          </div>
        </div>
      )}
      {typingNames.length > 0 && (
        <div className="px-4 py-1 text-xs text-muted-foreground italic flex items-center gap-2 border-t bg-background">
          <span className="inline-flex gap-0.5">
            <span className="size-1 rounded-full bg-muted-foreground animate-pulse" />
            <span className="size-1 rounded-full bg-muted-foreground animate-pulse [animation-delay:150ms]" />
            <span className="size-1 rounded-full bg-muted-foreground animate-pulse [animation-delay:300ms]" />
          </span>
          {typingNames.length === 1
            ? `${typingNames[0]} is typing…`
            : typingNames.length === 2
              ? `${typingNames.join(" and ")} are typing…`
              : "Several people are typing…"}
        </div>
      )}
    </div>
  );
}
