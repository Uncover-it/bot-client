"use client";

import { memo, useMemo } from "react";
import { Markdown } from "@/components/ui/markdown";
import type { Guild, Message } from "@/lib/discord/types";

interface Props {
  message: Message;
  guild?: Guild;
  selfUserId?: string;
}

function escapeMd(label: string): string {
  return label.replace(/[\\[\]()]/g, (c) => `\\${c}`);
}

export const MessageContent = memo(
  function MessageContent({ message, guild, selfUserId }: Props) {
    const userMap = useMemo(() => {
      const m = new Map<string, string>();
      message.mentions?.forEach((u) => {
        m.set(u.id, u.global_name ?? u.username);
      });
      return m;
    }, [message.mentions]);

    const channelMap = useMemo(() => {
      const m = new Map<string, string>();
      guild?.channels?.forEach((c) => {
        m.set(c.id, c.name ?? c.id);
      });
      return m;
    }, [guild?.channels]);

    const transformed = useMemo(() => {
      if (!message.content) return "";
      let s = message.content;
      s = s.replace(/<@!?(\d+)>/g, (_, id) => {
        const name = userMap.get(id) ?? id;
        const self = selfUserId && id === selfUserId ? "self" : "user";
        return `[@${escapeMd(name)}](dc:${self}/${id})`;
      });
      s = s.replace(/<@&(\d+)>/g, (_, id) => {
        const role = guild?.roles?.find((r) => r.id === id);
        const name = role?.name ?? id;
        const color = role?.color
          ? `#${role.color.toString(16).padStart(6, "0")}`
          : "";
        const q = color ? `?c=${encodeURIComponent(color)}` : "";
        return `[@${escapeMd(name)}](dc:role/${id}${q})`;
      });
      s = s.replace(/<#(\d+)>/g, (_, id) => {
        const name = channelMap.get(id) ?? id;
        return `[#${escapeMd(name)}](dc:channel/${id})`;
      });
      s = s.replace(
        /@(everyone|here)\b/g,
        (_, kind) => `[@${kind}](dc:broadcast/${kind})`,
      );
      s = s.replace(
        /<(a?):(\w+):(\d+)>/g,
        (_, a, name, id) => `![:${name}:](dc:emoji/${id}?a=${a ? 1 : 0})`,
      );
      s = s.replace(/<t:(\d+)(?::([tTdDfFR]))?>/g, (_, ts) => {
        try {
          return new Date(Number(ts) * 1000).toLocaleString();
        } catch {
          return _;
        }
      });
      s = s.replace(
        /(^|[\s(])((?:https?:\/\/)?(?:discord\.gg|discord\.invite|discord\.com\/invite)\/[a-zA-Z0-9-]+)/gi,
        (_, lead, raw) => {
          const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
          return `${lead}[${raw}](${url})`;
        },
      );
      return s;
    }, [message.content, userMap, channelMap, guild?.roles, selfUserId]);

    return <Markdown>{transformed}</Markdown>;
  },
  (a, b) =>
    a.message === b.message &&
    a.guild?.roles === b.guild?.roles &&
    a.guild?.channels === b.guild?.channels &&
    a.selfUserId === b.selfUserId,
);
