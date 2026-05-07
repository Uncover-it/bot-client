"use client";

import { memo, useMemo, type ReactNode } from "react";
import { CornerUpRight, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { DiscordAvatar } from "@/components/ui/discord-avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageContent } from "@/components/discord/message-content";
import { MessageEmbed } from "@/components/discord/message-embed";
import { MessageAttachment } from "@/components/discord/message-attachment";
import { avatarUrl, memberAvatarUrl } from "@/lib/discord/cdn";
import type { Guild, GuildMember, Message, Presence } from "@/lib/discord/types";

interface Props {
  message: Message;
  prev?: Message;
  guild?: Guild;
  presence?: Presence;
  guildId?: string;
  storeMember?: GuildMember;
  mentionsMe?: boolean;
  isPostStarter?: boolean;
  contextMenu?: (m: Message) => React.ReactNode;
  authorMenu?: (m: Message) => React.ReactNode;
  nameWrapper?: (m: Message, children: ReactNode) => ReactNode;
  onJumpReply?: (id: string) => void;
  hoverToolbar?: (m: Message) => ReactNode;
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

function authorColor(
  message: Message,
  guild?: Guild,
  storeMember?: GuildMember,
): string | undefined {
  const memberRoles = message.member?.roles ?? storeMember?.roles;
  if (!guild?.roles || !memberRoles) return undefined;
  const sorted = [...guild.roles]
    .filter((r) => memberRoles.includes(r.id) && r.color !== 0)
    .sort((a, b) => b.position - a.position);
  if (!sorted.length) return undefined;
  return "#" + sorted[0].color.toString(16).padStart(6, "0");
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
  storeMember,
  mentionsMe,
  isPostStarter,
  contextMenu,
  authorMenu,
  nameWrapper,
  onJumpReply,
  hoverToolbar,
}: Props) {
  const grouped = shouldGroup(prev, message);
  const color = useMemo(
    () => authorColor(message, guild, storeMember),
    [message, guild, storeMember],
  );
  const displayName =
    message.member?.nick ??
    storeMember?.nick ??
    message.author.global_name ??
    message.author.username;

  const memberAv = guildId
    ? memberAvatarUrl(guildId, message.author.id, message.member?.avatar)
    : null;
  const av = memberAv ?? avatarUrl(message.author.id, message.author.avatar);

  return (
    <div
      data-message-id={message.id}
      className={cn(
        "group/msg relative flex gap-3 px-2 md:px-4 transition-colors min-w-0",
        grouped ? "py-0.5" : "pt-3 pb-1",
        mentionsMe
          ? "bg-yellow-500/10 hover:bg-yellow-500/15 border-l-2 border-yellow-500"
          : isPostStarter
            ? "bg-primary/[0.04] hover:bg-primary/[0.08] border-l-2 border-primary/60"
            : "hover:bg-muted/30",
      )}
    >
      {hoverToolbar && (
        <div className="absolute -top-3 right-4 opacity-0 group-hover/msg:opacity-100 transition-opacity z-[1] flex items-center gap-0.5 bg-popover border rounded-md shadow-sm px-1 py-0.5">
          {hoverToolbar(message)}
        </div>
      )}
      {message.message_reference && message.referenced_message && (
        <button
          onClick={() => onJumpReply?.(message.referenced_message!.id)}
          className="absolute -top-0.5 left-12 right-4 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground truncate cursor-pointer transition-colors"
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
          <span className="font-medium">
            {message.referenced_message.author.global_name ??
              message.referenced_message.author.username}
          </span>
          <span className="truncate opacity-70">
            {message.referenced_message.content || "[embed]"}
          </span>
        </button>
      )}

      <div className="w-10 shrink-0 flex justify-center">
        {grouped ? (
          <span className="text-[10px] text-muted-foreground opacity-0 group-hover/msg:opacity-100 self-center font-mono">
            {shortTime(message.timestamp)}
          </span>
        ) : (
          <div className={cn(message.message_reference && "mt-3")}>
            {authorMenu ? authorMenu(message) : (
              <DiscordAvatar src={av} alt={displayName} size={36} />
            )}
          </div>
        )}
      </div>

      <div className={cn("flex-1 min-w-0", message.message_reference && !grouped && "mt-3")}>
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

        <div className="text-sm leading-snug">
          {contextMenu ? (
            contextMenu(message)
          ) : (
            <>
              {message.content && <MessageContent message={message} guild={guild} />}
              {message.edited_timestamp && (
                <span className="text-[10px] text-muted-foreground ml-1">(edited)</span>
              )}
            </>
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
      </div>
    </div>
  );
});
