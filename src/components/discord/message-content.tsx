"use client";

import { memo, useMemo } from "react";
import { Markdown } from "@/components/ui/markdown";
import type { Guild, Message, Role } from "@/lib/discord/types";

interface Props {
  message: Message;
  guild?: Guild;
}

function colorOfRoleId(roleId: string, roles: Role[] = []): number {
  const r = roles.find((x) => x.id === roleId);
  return r?.color ?? 0;
}

function hex(n: number): string {
  if (!n) return "";
  return "#" + n.toString(16).padStart(6, "0");
}

export const MessageContent = memo(function MessageContent({ message, guild }: Props) {
  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    message.mentions?.forEach((u) => m.set(u.id, u.global_name ?? u.username));
    return m;
  }, [message.mentions]);

  const channelMap = useMemo(() => {
    const m = new Map<string, string>();
    guild?.channels?.forEach((c) => m.set(c.id, c.name ?? c.id));
    return m;
  }, [guild?.channels]);

  const transformed = useMemo(() => {
    if (!message.content) return "";
    let s = message.content;
    s = s.replace(/<@!?(\d+)>/g, (_, id) => `**@${userMap.get(id) ?? id}**`);
    s = s.replace(/<@&(\d+)>/g, (_, id) => {
      const role = guild?.roles?.find((r) => r.id === id);
      return role ? `**@${role.name}**` : `**@&${id}**`;
    });
    s = s.replace(/<#(\d+)>/g, (_, id) => `**#${channelMap.get(id) ?? id}**`);
    s = s.replace(/<a?:(\w+):(\d+)>/g, (_, name) => `:${name}:`);
    s = s.replace(/<t:(\d+)(?::([tTdDfFR]))?>/g, (_, ts) => {
      try {
        return new Date(Number(ts) * 1000).toLocaleString();
      } catch {
        return _;
      }
    });
    return s;
  }, [message.content, userMap, channelMap, guild?.roles]);

  return <Markdown>{transformed}</Markdown>;
}, (a, b) => a.message === b.message && a.guild?.roles === b.guild?.roles && a.guild?.channels === b.guild?.channels);

export { hex, colorOfRoleId };
