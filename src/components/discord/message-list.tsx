"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useChannelPermissions } from "@/hooks/use-permissions";
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
  ban,
  deleteMessage,
  getMessages,
  kick,
  pinMessage,
  setTimeout as serverTimeout,
  unpinMessage,
} from "@/api/data/actions";
import {
  ClockPlus,
  ExternalLink,
  Trash2,
  Pin,
  PinOff,
  UserRoundMinus,
  Ban,
  Reply,
} from "lucide-react";
import Link from "next/link";
import {
  CopyID,
  CopyMessage,
  CopyUsername,
} from "@/components/contextMenuHandellers";
import { MessageItem } from "@/components/discord/message";
import { MessageContent } from "@/components/discord/message-content";
import { UserProfilePopover } from "@/components/discord/user-profile-popover";
import { useRealtimeStore } from "@/lib/store";
import type { GuildMember, Message } from "@/lib/discord/types";
import type { ReplyTarget } from "@/components/discord/message-input";
import { DiscordAvatar } from "@/components/ui/discord-avatar";
import { avatarUrl } from "@/lib/discord/cdn";

interface Props {
  channelId: string;
  serverId: string;
  channelName?: string;
  postStarterId?: string;
  onReply: (target: ReplyTarget) => void;
}

export function MessageList({ channelId, serverId, postStarterId, onReply }: Props) {
  const messages = useRealtimeStore((s) => s.messages.get(channelId));
  const roles = useRealtimeStore((s) => s.guilds.get(serverId)?.roles);
  const channels = useRealtimeStore((s) => s.guilds.get(serverId)?.channels);
  const typingMap = useRealtimeStore((s) => s.typing.get(channelId));
  const members = useRealtimeStore((s) => s.members.get(serverId));
  const setMessages = useRealtimeStore((s) => s.setMessages);
  const prepend = useRealtimeStore((s) => s.prependMessages);
  const botUserId = useRealtimeStore((s) => s.user?.id);
  const perms = useChannelPermissions(serverId, channelId);
  const canManageMessages = can(perms, "Manage Messages");
  const guild = useMemo(() => ({ id: serverId, name: "", features: [], roles, channels }), [serverId, roles, channels]);

  const [hydrating, setHydrating] = useState(!messages);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const jumpTo = useCallback((id: string) => {
    const el = scrollRef.current?.querySelector(`[data-message-id="${id}"]`) as HTMLElement | null;
    if (!el) {
      toast.message("Message not loaded", { description: "Scroll up to find it." });
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary", "bg-primary/10");
    setTimeout(() => el.classList.remove("ring-2", "ring-primary", "bg-primary/10"), 1500);
  }, []);

  useEffect(() => {
    let alive = true;
    setHydrating(!useRealtimeStore.getState().messages.get(channelId));
    setExhausted(false);
    (async () => {
      try {
        const fresh: Message[] = await getMessages(channelId);
        if (!alive || !Array.isArray(fresh)) return;
        setMessages(channelId, fresh);
      } catch {
        toast.error("Failed to load messages");
      } finally {
        if (alive) setHydrating(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [channelId, setMessages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || hydrating) return;
    if (atBottom) el.scrollTop = el.scrollHeight;
  }, [messages, hydrating, atBottom]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distanceFromBottom < 80);
    if (el.scrollTop < 60 && !loadingOlder && !exhausted && messages?.length) {
      loadOlder();
    }
  }

  async function loadOlder() {
    if (!messages?.length) return;
    setLoadingOlder(true);
    try {
      const oldest = messages[messages.length - 1];
      const older: Message[] = await getMessages(channelId, oldest.id);
      if (Array.isArray(older) && older.length) prepend(channelId, older);
      else setExhausted(true);
    } finally {
      setLoadingOlder(false);
    }
  }

  const timeoutMember = useCallback(
    (userId: string, minutes: number | null) => {
      const p = async () => {
        const iso = minutes == null ? null : new Date(Date.now() + minutes * 60000).toISOString();
        const res = await serverTimeout(serverId, userId, iso);
        if (res.message) throw new Error(res.message);
      };
      toast.promise(p(), {
        loading: "Setting timeout",
        success: "Timeout set",
        error: (e) => `Error: ${e.message}`,
      });
    },
    [serverId],
  );

  const renderHoverToolbar = useCallback(
    (msg: Message) => (
      <>
        <button
          onClick={() =>
            onReply({
              id: msg.id,
              author: msg.author.global_name ?? msg.author.username,
              content: msg.content || "[attachment]",
            })
          }
          className="size-6 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          title="Reply"
        >
          <Reply className="size-3" />
        </button>
        <button
          onClick={() => {
            const p = async () => {
              if (!msg.pinned) await pinMessage(channelId, msg.id);
              else await unpinMessage(channelId, msg.id);
            };
            toast.promise(p(), { loading: "Updating", success: "Done" });
          }}
          className="size-6 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          title={msg.pinned ? "Unpin" : "Pin"}
        >
          {msg.pinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
        </button>
        {(msg.author.id === useRealtimeStore.getState().user?.id || canManageMessages) && (
          <button
            onClick={() => {
              const p = async () => deleteMessage(channelId, msg.id);
              toast.promise(p(), { loading: "Deleting", success: "Deleted" });
            }}
            className="size-6 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </>
    ),
    [onReply, channelId, canManageMessages],
  );

  const renderNameWrapper = useCallback(
    (msg: Message, children: React.ReactNode) => (
      <UserProfilePopover
        guildId={serverId}
        userId={msg.author.id}
        trigger={children}
      />
    ),
    [serverId],
  );

  const renderAuthorMenu = useCallback(
    (msg: Message) => (
      <ContextMenu>
        <UserProfilePopover
          guildId={serverId}
          userId={msg.author.id}
          trigger={
            <ContextMenuTrigger asChild>
              <button>
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
          {!msg.author.bot && (
            <>
              <ContextMenuGroup>
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
                        {min < 60 ? `${min} min` : min < 1440 ? `${min / 60} hr` : `${min / 1440} day`}
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
                <ContextMenuItem
                  variant="destructive"
                  onSelect={() => kick(serverId, msg.author.id)}
                >
                  <UserRoundMinus /> Kick
                </ContextMenuItem>
                <ContextMenuItem
                  variant="destructive"
                  onSelect={() => ban(serverId, msg.author.id)}
                >
                  <Ban /> Ban
                </ContextMenuItem>
              </ContextMenuGroup>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuGroup>
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
    [serverId, timeoutMember],
  );

  const renderContextMenu = useCallback(
    (msg: Message) => (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="min-w-0 break-words">
            {msg.content && <MessageContent message={msg} guild={guild} />}
            {msg.edited_timestamp && (
              <span className="text-[10px] text-muted-foreground ml-1">(edited)</span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="bg-sidebar font-mono tracking-tighter">
          <ContextMenuGroup>
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
            <ContextMenuItem
              onSelect={() => {
                const p = async () => {
                  if (!msg.pinned) await pinMessage(channelId, msg.id);
                  else await unpinMessage(channelId, msg.id);
                };
                toast.promise(p(), { loading: "Updating", success: "Done" });
              }}
            >
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
            <ContextMenuItem
              variant="destructive"
              onSelect={() => {
                const p = async () => deleteMessage(channelId, msg.id);
                toast.promise(p(), { loading: "Deleting", success: "Deleted" });
              }}
            >
              <Trash2 /> Delete
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <CopyMessage message={msg.content} />
            <CopyID id={msg.id} />
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    ),
    [guild, onReply, channelId],
  );

  const typingNames = useMemo(() => {
    if (!typingMap) return [];
    const ids = Array.from(typingMap.keys());
    const names: string[] = [];
    ids.forEach((id) => {
      const m = members?.find((mm) => mm.user?.id === id);
      if (m) names.push(m.nick ?? m.user?.global_name ?? m.user?.username ?? id);
      else names.push(id);
    });
    return names.slice(0, 3);
  }, [typingMap, members]);

  const memberById = useMemo(() => {
    const m = new Map<string, GuildMember>();
    members?.forEach((mm) => {
      if (mm.user?.id) m.set(mm.user.id, mm);
    });
    return m;
  }, [members]);

  if (hydrating) {
    return (
      <div className="size-full flex items-center justify-center text-muted-foreground">
        <LoaderCircle className="animate-spin mr-2" />
        Loading messages
      </div>
    );
  }

  const list = messages ?? [];
  const ordered = [...list].reverse();

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden min-w-0"
      >
        {loadingOlder && (
          <div className="flex justify-center py-2 text-xs text-muted-foreground">
            <LoaderCircle className="animate-spin size-3 mr-1" /> Loading older
          </div>
        )}
        {exhausted && (
          <div className="text-center py-4 text-xs text-muted-foreground">
            Beginning of channel
          </div>
        )}
        <div>
          {ordered.map((m, i) => {
            const refAuthor = m.referenced_message?.author?.id;
            const replyToBot = !!botUserId && refAuthor === botUserId;
            const directMention =
              !!botUserId && (m.mentions ?? []).some((u) => u.id === botUserId);
            const mentionsMe =
              !!botUserId && m.author.id !== botUserId && (directMention || replyToBot);
            const isPostStarter = !!postStarterId && m.id === postStarterId;
            return (
              <MessageItem
                key={m.id}
                message={m}
                prev={ordered[i - 1]}
                guild={guild}
                guildId={serverId}
                storeMember={memberById.get(m.author.id)}
                mentionsMe={mentionsMe}
                isPostStarter={isPostStarter}
                onJumpReply={jumpTo}
                hoverToolbar={renderHoverToolbar}
                authorMenu={renderAuthorMenu}
                nameWrapper={renderNameWrapper}
                contextMenu={renderContextMenu}
              />
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
