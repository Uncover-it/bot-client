"use client";

import { create } from "zustand";
import type {
  Channel,
  Guild,
  GuildMember,
  Message,
  Presence,
  Role,
  User,
} from "@/lib/discord/types";
import type { GatewayState } from "@/lib/discord/gateway";

type ChannelMessages = Map<string, Message[]>;
type GuildMembers = Map<string, GuildMember[]>;
type GuildPresences = Map<string, Presence[]>;
type TypingMap = Map<string, Map<string, number>>;

interface State {
  user: User | null;
  guilds: Map<string, Guild>;
  messages: ChannelMessages;
  members: GuildMembers;
  presences: GuildPresences;
  typing: TypingMap;
  gatewayState: GatewayState;
  pingMs: number;
  restPingMs: number;
  activeIntents: number;
  setActiveIntents: (n: number) => void;
  setUser: (u: User | null) => void;
  setGatewayState: (s: GatewayState) => void;
  setPing: (ms: number) => void;
  setRestPing: (ms: number) => void;
  upsertGuild: (g: Guild) => void;
  setGuilds: (gs: Guild[]) => void;
  setChannels: (guildId: string, channels: Channel[]) => void;
  upsertChannel: (c: Channel) => void;
  removeChannel: (id: string, guildId?: string) => void;
  setRoles: (guildId: string, roles: Role[]) => void;
  setEmojis: (guildId: string, emojis: import("@/lib/discord/types").Emoji[]) => void;
  setMessages: (channelId: string, messages: Message[]) => void;
  prependMessages: (channelId: string, messages: Message[]) => void;
  addMessage: (m: Message) => void;
  updateMessage: (m: Message) => void;
  removeMessage: (channelId: string, messageId: string) => void;
  setMembers: (guildId: string, members: GuildMember[]) => void;
  upsertMember: (guildId: string, member: GuildMember) => void;
  removeMember: (guildId: string, userId: string) => void;
  addReaction: (
    channelId: string,
    messageId: string,
    emoji: { id?: string | null; name?: string | null; animated?: boolean },
    byMe: boolean,
  ) => void;
  removeReaction: (
    channelId: string,
    messageId: string,
    emoji: { id?: string | null; name?: string | null },
    byMe: boolean,
  ) => void;
  removeReactionEmoji: (
    channelId: string,
    messageId: string,
    emoji: { id?: string | null; name?: string | null },
  ) => void;
  removeAllReactions: (channelId: string, messageId: string) => void;
  upsertPresence: (guildId: string, presence: Presence) => void;
  setPresences: (guildId: string, presences: Presence[]) => void;
  setTyping: (channelId: string, userId: string) => void;
  pruneTyping: () => void;
}

export const useRealtimeStore = create<State>((set) => ({
  user: null,
  guilds: new Map(),
  messages: new Map(),
  members: new Map(),
  presences: new Map(),
  typing: new Map(),
  gatewayState: "idle",
  pingMs: 0,
  restPingMs: 0,
  activeIntents: 0,
  setActiveIntents: (n) => set({ activeIntents: n }),
  setUser: (u) => set({ user: u }),
  setGatewayState: (s) => set({ gatewayState: s }),
  setPing: (ms) => set({ pingMs: ms }),
  setRestPing: (ms) => set({ restPingMs: ms }),
  upsertGuild: (g) =>
    set((state) => {
      const next = new Map(state.guilds);
      const prev = next.get(g.id);
      next.set(g.id, { ...prev, ...g });
      return { guilds: next };
    }),
  setGuilds: (gs) =>
    set(() => {
      const next = new Map<string, Guild>();
      gs.forEach((g) => next.set(g.id, g));
      return { guilds: next };
    }),
  setChannels: (guildId, channels) =>
    set((state) => {
      const next = new Map(state.guilds);
      const g = next.get(guildId);
      if (!g) return {};
      next.set(guildId, { ...g, channels });
      return { guilds: next };
    }),
  upsertChannel: (c) =>
    set((state) => {
      if (!c.guild_id) return {};
      const next = new Map(state.guilds);
      const g = next.get(c.guild_id);
      if (!g) return {};
      const channels = (g.channels ?? []).filter((x) => x.id !== c.id).concat(c);
      next.set(c.guild_id, { ...g, channels });
      return { guilds: next };
    }),
  removeChannel: (id, guildId) =>
    set((state) => {
      if (!guildId) return {};
      const next = new Map(state.guilds);
      const g = next.get(guildId);
      if (!g) return {};
      next.set(guildId, { ...g, channels: (g.channels ?? []).filter((c) => c.id !== id) });
      return { guilds: next };
    }),
  setRoles: (guildId, roles) =>
    set((state) => {
      const next = new Map(state.guilds);
      const g = next.get(guildId);
      if (!g) return {};
      next.set(guildId, { ...g, roles });
      return { guilds: next };
    }),
  setEmojis: (guildId, emojis) =>
    set((state) => {
      const next = new Map(state.guilds);
      const g = next.get(guildId);
      if (!g) return {};
      next.set(guildId, { ...g, emojis });
      return { guilds: next };
    }),
  setMessages: (channelId, messages) =>
    set((state) => {
      const next = new Map(state.messages);
      next.set(channelId, messages);
      return { messages: next };
    }),
  prependMessages: (channelId, older) =>
    set((state) => {
      const next = new Map(state.messages);
      const cur = next.get(channelId) ?? [];
      const seen = new Set(cur.map((m) => m.id));
      const merged = cur.concat(older.filter((m) => !seen.has(m.id)));
      next.set(channelId, merged);
      return { messages: next };
    }),
  addMessage: (m) =>
    set((state) => {
      const next = new Map(state.messages);
      const cur = next.get(m.channel_id) ?? [];
      if (cur.find((x) => x.id === m.id)) return {};
      next.set(m.channel_id, [m, ...cur]);
      return { messages: next };
    }),
  updateMessage: (m) =>
    set((state) => {
      const next = new Map(state.messages);
      const cur = next.get(m.channel_id);
      if (!cur) return {};
      next.set(
        m.channel_id,
        cur.map((x) => (x.id === m.id ? { ...x, ...m } : x)),
      );
      return { messages: next };
    }),
  removeMessage: (channelId, messageId) =>
    set((state) => {
      const next = new Map(state.messages);
      const cur = next.get(channelId);
      if (!cur) return {};
      next.set(
        channelId,
        cur.filter((x) => x.id !== messageId),
      );
      return { messages: next };
    }),
  setMembers: (guildId, members) =>
    set((state) => {
      const next = new Map(state.members);
      const cur = next.get(guildId) ?? [];
      const map = new Map(cur.map((m) => [m.user?.id, m]));
      members.forEach((m) => {
        if (!m.user?.id) return;
        const existing = map.get(m.user.id);
        if (
          existing &&
          Array.isArray(existing.roles) &&
          existing.roles.length > 0 &&
          (!Array.isArray(m.roles) || m.roles.length === 0)
        ) {
          map.set(m.user.id, { ...existing, ...m, roles: existing.roles });
        } else if (existing) {
          map.set(m.user.id, { ...existing, ...m });
        } else {
          map.set(m.user.id, m);
        }
      });
      next.set(guildId, Array.from(map.values()));
      return { members: next };
    }),
  upsertMember: (guildId, member) =>
    set((state) => {
      const next = new Map(state.members);
      const cur = next.get(guildId) ?? [];
      const existing = cur.find((m) => m.user?.id === member.user?.id);
      const merged: GuildMember = existing ? { ...existing, ...member } : member;
      if (
        existing &&
        Array.isArray(existing.roles) &&
        existing.roles.length > 0 &&
        (!Array.isArray(member.roles) || member.roles.length === 0)
      ) {
        merged.roles = existing.roles;
      }
      const filtered = cur.filter((m) => m.user?.id !== member.user?.id);
      next.set(guildId, filtered.concat(merged));
      return { members: next };
    }),
  removeMember: (guildId, userId) =>
    set((state) => {
      const next = new Map(state.members);
      const cur = next.get(guildId);
      if (!cur) return {};
      next.set(
        guildId,
        cur.filter((m) => m.user?.id !== userId),
      );
      return { members: next };
    }),
  addReaction: (channelId, messageId, emoji, byMe) =>
    set((state) => {
      const next = new Map(state.messages);
      const cur = next.get(channelId);
      if (!cur) return {};
      const updated = cur.map((msg) => {
        if (msg.id !== messageId) return msg;
        const reactions = [...(msg.reactions ?? [])];
        const idx = reactions.findIndex((r) =>
          emoji.id ? r.emoji.id === emoji.id : !r.emoji.id && r.emoji.name === emoji.name,
        );
        if (idx >= 0) {
          const r = reactions[idx];
          if (byMe && r.me) {
            return msg;
          }
          reactions[idx] = {
            ...r,
            count: r.count + 1,
            me: r.me || byMe,
          };
        } else {
          reactions.push({
            count: 1,
            me: byMe,
            emoji: {
              id: emoji.id ?? null,
              name: emoji.name ?? null,
              animated: emoji.animated ?? false,
            },
          });
        }
        return { ...msg, reactions };
      });
      next.set(channelId, updated);
      return { messages: next };
    }),
  removeReaction: (channelId, messageId, emoji, byMe) =>
    set((state) => {
      const next = new Map(state.messages);
      const cur = next.get(channelId);
      if (!cur) return {};
      const updated = cur.map((msg) => {
        if (msg.id !== messageId) return msg;
        const reactions = (msg.reactions ?? []).flatMap((r) => {
          const match = emoji.id
            ? r.emoji.id === emoji.id
            : !r.emoji.id && r.emoji.name === emoji.name;
          if (!match) return [r];
          if (byMe && !r.me) return [r];
          const count = Math.max(0, r.count - 1);
          if (count === 0) return [];
          return [{ ...r, count, me: byMe ? false : r.me }];
        });
        return { ...msg, reactions };
      });
      next.set(channelId, updated);
      return { messages: next };
    }),
  removeReactionEmoji: (channelId, messageId, emoji) =>
    set((state) => {
      const next = new Map(state.messages);
      const cur = next.get(channelId);
      if (!cur) return {};
      const updated = cur.map((msg) => {
        if (msg.id !== messageId) return msg;
        const reactions = (msg.reactions ?? []).filter((r) =>
          emoji.id ? r.emoji.id !== emoji.id : r.emoji.id || r.emoji.name !== emoji.name,
        );
        return { ...msg, reactions };
      });
      next.set(channelId, updated);
      return { messages: next };
    }),
  removeAllReactions: (channelId, messageId) =>
    set((state) => {
      const next = new Map(state.messages);
      const cur = next.get(channelId);
      if (!cur) return {};
      const updated = cur.map((msg) =>
        msg.id === messageId ? { ...msg, reactions: [] } : msg,
      );
      next.set(channelId, updated);
      return { messages: next };
    }),
  upsertPresence: (guildId, presence) =>
    set((state) => {
      const next = new Map(state.presences);
      const cur = next.get(guildId) ?? [];
      const filtered = cur.filter((p) => p.user.id !== presence.user.id);
      next.set(guildId, filtered.concat(presence));
      return { presences: next };
    }),
  setPresences: (guildId, presences) =>
    set((state) => {
      const next = new Map(state.presences);
      const map = new Map<string, Presence>();
      (next.get(guildId) ?? []).forEach((p) => map.set(p.user.id, p));
      presences.forEach((p) => map.set(p.user.id, p));
      next.set(guildId, Array.from(map.values()));
      return { presences: next };
    }),
  setTyping: (channelId, userId) =>
    set((state) => {
      const next = new Map(state.typing);
      const inner = new Map(next.get(channelId) ?? []);
      inner.set(userId, Date.now() + 9000);
      next.set(channelId, inner);
      return { typing: next };
    }),
  pruneTyping: () =>
    set((state) => {
      const now = Date.now();
      const next = new Map<string, Map<string, number>>();
      state.typing.forEach((inner, k) => {
        const fresh = new Map<string, number>();
        inner.forEach((exp, uid) => {
          if (exp > now) fresh.set(uid, exp);
        });
        if (fresh.size) next.set(k, fresh);
      });
      return { typing: next };
    }),
}));
