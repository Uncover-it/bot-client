"use client";

import { memo, useEffect, useMemo, useRef, type ReactNode } from "react";
import { CornerUpRight, Pin, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DiscordAvatar } from "@/components/ui/discord-avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageContent } from "@/components/discord/message-content";
import { MessageEmbed } from "@/components/discord/message-embed";
import { MessageAttachment } from "@/components/discord/message-attachment";
import { MessageReactions } from "@/components/discord/message-reactions";
import { avatarUrl, memberAvatarUrl, stickerUrl } from "@/lib/discord/cdn";
import { readableRoleColor } from "@/lib/discord/role-color";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import type { Guild, GuildMember, Message, Presence } from "@/lib/discord/types";

interface Props {
  message: Message;
  prev?: Message;
  guild?: Guild;
  presence?: Presence;
  guildId?: string;
  selfUserId?: string;
  storeMember?: GuildMember;
  mentionsMe?: boolean;
  isPostStarter?: boolean;
  editing?: boolean;
  onEditSave?: (next: string) => void;
  onEditCancel?: () => void;
  rowContextMenu?: (m: Message, children: ReactNode) => ReactNode;
  authorMenu?: (m: Message) => React.ReactNode;
  nameWrapper?: (m: Message, children: ReactNode) => ReactNode;
  onJumpReply?: (id: string) => void;
  hoverToolbar?: (m: Message) => ReactNode;
  mobileMenu?: (m: Message) => ReactNode;
}

function timeFmt(d: string): string {
  const date = new Date(d);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today at ${time}`;
  if (isYesterday) return `Yesterday at ${time}`;
  return date.toLocaleString();
}

function shortTime(d: string): string {
  return new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const colorCache = new Map<string, string>();

function authorColor(
  message: Message,
  guild?: Guild,
  storeMember?: GuildMember,
): string | undefined {
  const memberRoles = message.member?.roles ?? storeMember?.roles;
  const cacheKey = guild?.id ? `${guild.id}:${message.author.id}` : undefined;
  if (!guild?.roles || !memberRoles) {
    return cacheKey ? colorCache.get(cacheKey) : undefined;
  }
  const sorted = [...guild.roles]
    .filter((r) => memberRoles.includes(r.id) && r.color !== 0)
    .sort((a, b) => b.position - a.position);
  if (!sorted.length) {
    return cacheKey ? colorCache.get(cacheKey) : undefined;
  }
  const hex = "#" + sorted[0].color.toString(16).padStart(6, "0");
  if (cacheKey) colorCache.set(cacheKey, hex);
  return hex;
}

function shouldGroup(prev: Message | undefined, m: Message): boolean {
  if (!prev) return false;
  if (prev.author.id !== m.author.id) return false;
  if (m.message_reference) return false;
  if (prev.message_reference) return false;
  const prevTime = new Date(prev.timestamp).getTime();
  const curTime = new Date(m.timestamp).getTime();
  return Math.abs(curTime - prevTime) < 7 * 60 * 1000;
}

export const MessageItem = memo(function MessageItem({
  message,
  prev,
  guild,
  guildId,
  selfUserId,
  storeMember,
  mentionsMe,
  isPostStarter,
  editing,
  onEditSave,
  onEditCancel,
  rowContextMenu,
  authorMenu,
  nameWrapper,
  onJumpReply,
  hoverToolbar,
  mobileMenu,
}: Props) {
  const grouped = shouldGroup(prev, message);
  const editRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!editing) return;
    const ta = editRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }, [editing]);
  const theme = useResolvedTheme();
  const rawColor = useMemo(
    () => authorColor(message, guild, storeMember),
    [message, guild, storeMember],
  );
  const color = readableRoleColor(rawColor, theme);
  const displayName =
    message.member?.nick ??
    storeMember?.nick ??
    message.author.global_name ??
    message.author.username;

  const memberAv = guildId
    ? memberAvatarUrl(guildId, message.author.id, message.member?.avatar)
    : null;
  const av = memberAv ?? avatarUrl(message.author.id, message.author.avatar);

  const body = (
    <div
      data-message-id={message.id}
      className={cn(
        "group/msg relative px-2 md:px-4 transition-colors min-w-0",
        grouped ? "py-0.5" : "pt-2 pb-1",
        mentionsMe
          ? "bg-[oklch(0.7686_0.1647_70.08/0.08)] hover:bg-[oklch(0.7686_0.1647_70.08/0.14)] border-l-2 border-brand"
          : isPostStarter
            ? "bg-primary/[0.04] hover:bg-primary/[0.08] border-l-2 border-primary/60"
            : "hover:bg-muted/30",
        message.__failed && "bg-destructive/10",
      )}
    >
      {hoverToolbar && (
        <div className="absolute -top-3 right-2 md:right-4 opacity-0 group-hover/msg:opacity-100 transition-opacity z-[1] hidden md:flex items-center gap-0.5 bg-popover border rounded-md shadow-sm px-1 py-0.5">
          {hoverToolbar(message)}
        </div>
      )}
      {mobileMenu && (
        <div className="absolute top-1.5 right-1 md:hidden z-[1]">
          {mobileMenu(message)}
        </div>
      )}
      {message.message_reference && message.referenced_message && (
        <button
          type="button"
          onClick={() => onJumpReply?.(message.referenced_message!.id)}
          className="flex items-center gap-1 ml-12 mr-4 mb-0.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors min-w-0 max-w-[calc(100%-4rem)]"
        >
          <CornerUpRight className="size-3 shrink-0" />
          <DiscordAvatar
            src={avatarUrl(
              message.referenced_message.author.id,
              message.referenced_message.author.avatar,
            )}
            alt=""
            size={16}
          />
          <span className="font-medium shrink-0">
            {message.referenced_message.author.global_name ??
              message.referenced_message.author.username}
          </span>
          <span className="truncate opacity-70">
            {message.referenced_message.content || "[embed]"}
          </span>
        </button>
      )}

      <div className="flex gap-3 min-w-0 items-start">
        <div className="w-10 shrink-0 flex justify-center">
          {grouped ? (
            <span className="text-[10px] text-muted-foreground opacity-0 group-hover/msg:opacity-100 self-center font-mono">
              {shortTime(message.timestamp)}
            </span>
          ) : authorMenu ? (
            authorMenu(message)
          ) : (
            <DiscordAvatar src={av} alt={displayName} size={36} />
          )}
        </div>

        <div className="flex-1 min-w-0">
        {!grouped && (
          <div className="flex items-baseline gap-2 leading-tight flex-wrap">
            {nameWrapper ? (
              nameWrapper(
                message,
                <button
                  className="font-semibold text-sm hover:underline cursor-pointer"
                  style={color ? { color } : undefined}
                >
                  {displayName}
                </button>,
              )
            ) : (
              <span className="font-semibold text-sm" style={color ? { color } : undefined}>
                {displayName}
              </span>
            )}
            {message.author.bot && (
              <span className="px-1 py-0.5 rounded bg-blue-500 text-white text-[9px] font-bold uppercase">
                Bot
              </span>
            )}
            {isPostStarter && (
              <span className="px-1 py-0.5 rounded bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider">
                OP
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground cursor-default">
                  {timeFmt(message.timestamp)}
                </span>
              </TooltipTrigger>
              <TooltipContent>{new Date(message.timestamp).toLocaleString()}</TooltipContent>
            </Tooltip>
            {message.pinned && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Pin className="size-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Pinned</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        <div
          className={cn(
            "text-sm leading-snug",
            message.__pending && !editing && "text-muted-foreground",
          )}
        >
          {editing ? (
            <div className="space-y-1">
              <Textarea
                key={`edit-${message.id}`}
                ref={editRef}
                defaultValue={message.content ?? ""}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    onEditSave?.(e.currentTarget.value);
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    onEditCancel?.();
                  }
                }}
                className="resize-none min-h-10 max-h-48 field-sizing-content text-sm"
              />
              <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                <span>
                  <kbd>esc</kbd> cancel
                </span>
                <span>
                  <kbd>↵</kbd> save
                </span>
                <button
                  type="button"
                  onClick={() => onEditCancel?.()}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  cancel
                </button>
                <button
                  type="button"
                  onClick={() => onEditSave?.(editRef.current?.value ?? "")}
                  className="text-primary hover:underline font-medium"
                >
                  save
                </button>
              </div>
            </div>
          ) : (
            <span className="[&_p:last-child]:inline">
              {message.content && (
                <MessageContent
                  message={message}
                  guild={guild}
                  selfUserId={selfUserId}
                />
              )}
              {message.edited_timestamp && !message.__pending && !message.__failed && (
                <span className="text-[10px] text-muted-foreground ml-1 align-baseline">
                  (edited)
                </span>
              )}
              {message.__failed && (
                <span className="text-[10px] text-destructive ml-1 inline-flex items-center gap-1 align-baseline">
                  <AlertCircle className="size-3" /> failed
                </span>
              )}
            </span>
          )}
        </div>

        {message.attachments?.length > 0 && (
          <div className="mt-1 space-y-2">
            {message.attachments.map((a) => (
              <MessageAttachment key={a.id} a={a} />
            ))}
          </div>
        )}

        {message.embeds?.length > 0 && (
          <div className="mt-1 space-y-2">
            {message.embeds.map((e, i) => (
              <MessageEmbed key={i} embed={e} />
            ))}
          </div>
        )}
        {message.sticker_items && message.sticker_items.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {message.sticker_items.map((s) =>
              s.format_type === 3 ? (
                <div
                  key={s.id}
                  className="px-2 py-1 rounded bg-muted text-xs text-muted-foreground"
                  title={s.name}
                >
                  Sticker: {s.name}
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={s.id}
                  src={stickerUrl(s.id, s.format_type, 160)}
                  alt={s.name}
                  title={s.name}
                  width={160}
                  height={160}
                  className="rounded"
                  draggable={false}
                />
              ),
            )}
          </div>
        )}
        {guildId && message.reactions && message.reactions.length > 0 && (
          <MessageReactions
            guildId={guildId}
            channelId={message.channel_id}
            messageId={message.id}
            reactions={message.reactions}
          />
        )}
        </div>
      </div>
    </div>
  );
  return rowContextMenu ? <>{rowContextMenu(message, body)}</> : body;
});
