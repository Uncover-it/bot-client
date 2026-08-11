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
import {
  loadStoredDms,
  markDmsHydrated,
  resetDmStorage,
  storeDms,
} from "@/lib/discord/dm-storage";

type ChannelMessages = Map<string, Message[]>;
type GuildMembers = Map<string, GuildMember[]>;
type GuildPresences = Map<string, Presence[]>;
type TypingMap = Map<string, Map<string, number>>;

/**
 * Ceiling on a single channel's history. Only live gateway appends trim (the
 * oldest fall out); pagination is user-driven and left alone so scrolling up
 * never fights the cap.
 */
const MAX_MESSAGES_PER_CHANNEL = 1000;

/** How many channels keep their history once the user navigates away. */
const MAX_CACHED_CHANNELS = 8;

interface State {
  user: User | null;
  guilds: Map<string, Guild>;
  messages: ChannelMessages;
  /** LRU of opened channels, most recently opened last. */
  channelOrder: string[];
  members: GuildMembers;
  /**
   * The bot's own member object per guild, mirrored out of `members` so
   * permission and timeout lookups are O(1) and do not re-run when an
   * unrelated member changes.
   */
  selfMembers: Map<string, GuildMember>;
  presences: GuildPresences;
  typing: TypingMap;
  /** Open DM channels, oldest first. Persisted, see dm-storage. */
  dms: Map<string, Channel>;
  dmsHydrated: boolean;
  /** Unread message count per channel, cleared when the channel is opened. */
  unread: Map<string, number>;
  /** Channels where an unread message mentions or replies to the bot. */
  unreadMentions: Set<string>;
  /** Channel currently on screen. Its messages never count as unread. */
  activeChannelId: string | null;
  gatewayState: GatewayState;
  pingMs: number;
  activeIntents: number;
  setActiveIntents: (n: number) => void;
  setUser: (u: User | null) => void;
  setGatewayState: (s: GatewayState) => void;
  setPing: (ms: number) => void;
  upsertGuild: (g: Guild) => void;
  setChannels: (guildId: string, channels: Channel[]) => void;
  upsertChannel: (c: Channel) => void;
  removeChannel: (id: string, guildId?: string) => void;
  setRoles: (guildId: string, roles: Role[]) => void;
  setEmojis: (
    guildId: string,
    emojis: import("@/lib/discord/types").Emoji[],
  ) => void;
  openChannel: (channelId: string) => void;
  setMessages: (channelId: string, messages: Message[]) => void;
  prependMessages: (channelId: string, messages: Message[]) => void;
  addMessage: (m: Message) => void;
  updateMessage: (m: Message) => void;
  replaceMessage: (channelId: string, oldId: string, next: Message) => void;
  markMessageFailed: (channelId: string, id: string) => void;
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
  markReactionPending: (
    channelId: string,
    messageId: string,
    emoji: { id?: string | null; name?: string | null },
    on: boolean,
  ) => void;
  setPresences: (guildId: string, presences: Presence[]) => void;
  setTyping: (channelId: string, userId: string) => void;
  pruneTyping: () => void;
  hydrateDms: (botId: string) => void;
  upsertDm: (c: Channel) => void;
  removeDm: (channelId: string) => void;
  bumpUnread: (channelId: string, mention: boolean) => void;
  setActiveChannel: (channelId: string | null) => void;
  /** Drops everything that belonged to the bot that is logging out. */
  reset: () => void;
}

/**
 * The part of the store that belongs to one bot. Logging in as another bot has
 * to drop all of it: a different bot is in different guilds, sees different
 * members and has different DMs. The connection fields (gateway state, ping,
 * intents) are deliberately not in here, they describe the live socket.
 */
type Session = Pick<
  State,
  | "user"
  | "guilds"
  | "messages"
  | "channelOrder"
  | "members"
  | "selfMembers"
  | "presences"
  | "typing"
  | "dms"
  | "dmsHydrated"
  | "unread"
  | "unreadMentions"
  | "activeChannelId"
>;

function emptySession(): Session {
  return {
    user: null,
    guilds: new Map(),
    messages: new Map(),
    channelOrder: [],
    members: new Map(),
    selfMembers: new Map(),
    presences: new Map(),
    typing: new Map(),
    dms: new Map(),
    dmsHydrated: false,
    unread: new Map(),
    unreadMentions: new Set(),
    activeChannelId: null,
  };
}

/** DM and group DM. Everything else belongs to a guild. */
function isDmChannel(c: Channel): boolean {
  return c.type === 1 || c.type === 3;
}

/**
 * Keeps `selfMembers[guildId]` pointing at the same object the members list
 * holds, but only writes a new Map when something consumers care about moved.
 * Permission resolution and the timeout banner both subscribe here, and a
 * member chunk landing every 150ms would otherwise re-run them for nothing.
 */
function mirrorSelf(
  state: State,
  guildId: string,
  self: GuildMember,
): Map<string, GuildMember> {
  const prev = state.selfMembers.get(guildId);
  if (
    prev &&
    prev.communication_disabled_until === self.communication_disabled_until &&
    sameRoles(prev.roles, self.roles)
  ) {
    return state.selfMembers;
  }
  const next = new Map(state.selfMembers);
  next.set(guildId, self);
  return next;
}

function sameRoles(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((r, i) => r === b[i]);
}

export const useRealtimeStore = create<State>((set) => ({
  ...emptySession(),
  gatewayState: "idle",
  pingMs: 0,
  activeIntents: 0,
  setActiveIntents: (n) => set({ activeIntents: n }),
  setUser: (u) =>
    set((state) => {
      if (!u?.id || state.user?.id === u.id) return { user: u };
      if (state.user) {
        // Another bot logged in. This store is module state and survives the
        // client-side navigation through the login screen, so without this the
        // previous bot's guilds, members and messages stay on screen.
        resetDmStorage();
        const dms = new Map<string, Channel>();
        loadStoredDms(u.id).forEach((c) => {
          dms.set(c.id, c);
        });
        markDmsHydrated();
        return { ...emptySession(), user: u, dms, dmsHydrated: true };
      }
      // Members can land before READY does. Once the bot's own id is known,
      // pick its member object out of whatever already arrived.
      const selfMembers = new Map<string, GuildMember>();
      state.members.forEach((list, guildId) => {
        const self = list.find((m) => m.user?.id === u.id);
        if (self) selfMembers.set(guildId, self);
      });
      return { user: u, selfMembers };
    }),
  setGatewayState: (s) => set({ gatewayState: s }),
  setPing: (ms) => set({ pingMs: ms }),
  upsertGuild: (g) =>
    set((state) => {
      const next = new Map(state.guilds);
      const prev = next.get(g.id);
      next.set(g.id, { ...prev, ...g });
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
      if (isDmChannel(c)) {
        const dms = new Map(state.dms);
        dms.set(c.id, { ...dms.get(c.id), ...c });
        storeDms(dms.values());
        return { dms };
      }
      if (!c.guild_id) return {};
      const next = new Map(state.guilds);
      const g = next.get(c.guild_id);
      if (!g) return {};
      const channels = (g.channels ?? [])
        .filter((x) => x.id !== c.id)
        .concat(c);
      next.set(c.guild_id, { ...g, channels });
      return { guilds: next };
    }),
  removeChannel: (id, guildId) =>
    set((state) => {
      if (!guildId) return {};
      const next = new Map(state.guilds);
      const g = next.get(guildId);
      if (!g) return {};
      next.set(guildId, {
        ...g,
        channels: (g.channels ?? []).filter((c) => c.id !== id),
      });
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
  openChannel: (channelId) =>
    set((state) => {
      const order = state.channelOrder.filter((id) => id !== channelId);
      order.push(channelId);
      const messages = new Map(state.messages);
      // Seed the entry so gateway messages that land before the first REST
      // page are kept instead of dropped by addMessage.
      if (!messages.has(channelId)) messages.set(channelId, []);
      while (order.length > MAX_CACHED_CHANNELS) {
        const evicted = order.shift();
        if (evicted) messages.delete(evicted);
      }
      const patch: Partial<State> = {
        channelOrder: order,
        messages,
        activeChannelId: channelId,
      };
      if (state.unread.has(channelId)) {
        const unread = new Map(state.unread);
        unread.delete(channelId);
        patch.unread = unread;
      }
      if (state.unreadMentions.has(channelId)) {
        const mentions = new Set(state.unreadMentions);
        mentions.delete(channelId);
        patch.unreadMentions = mentions;
      }
      return patch;
    }),
  setMessages: (channelId, messages) =>
    set((state) => {
      const next = new Map(state.messages);
      const cur = next.get(channelId);
      // Whatever is already here arrived over the gateway (or is still
      // pending) while this page was in flight, so it is newer than the
      // entire page and stays at the front.
      const ids = new Set(messages.map((m) => m.id));
      const live = cur?.filter((m) => !ids.has(m.id)) ?? [];
      next.set(channelId, live.length ? live.concat(messages) : messages);
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
      const cur = state.messages.get(m.channel_id);
      // Only track channels the user has opened. Without this the store
      // accumulates every message in every channel the bot can see, forever.
      if (!cur) return {};
      if (cur.some((x) => x.id === m.id)) return {};
      const next = new Map(state.messages);
      if (m.nonce != null) {
        const nonceStr = String(m.nonce);
        const idx = cur.findIndex(
          (x) => x.__pending && x.nonce != null && String(x.nonce) === nonceStr,
        );
        if (idx >= 0) {
          const merged = cur.slice();
          merged[idx] = { ...m, __pending: false, __failed: false };
          next.set(m.channel_id, merged);
          return { messages: next };
        }
      }
      const grown = [m, ...cur];
      next.set(
        m.channel_id,
        grown.length > MAX_MESSAGES_PER_CHANNEL
          ? grown.slice(0, MAX_MESSAGES_PER_CHANNEL)
          : grown,
      );
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
  replaceMessage: (channelId, oldId, nextMsg) =>
    set((state) => {
      const next = new Map(state.messages);
      const cur = next.get(channelId);
      if (!cur) return {};
      const seenReal = cur.some((x) => x.id === nextMsg.id && x.id !== oldId);
      const filtered = seenReal ? cur.filter((x) => x.id !== oldId) : cur;
      const replaced = seenReal
        ? filtered
        : filtered.map((x) =>
            x.id === oldId
              ? { ...nextMsg, __pending: false, __failed: false }
              : x,
          );
      next.set(channelId, replaced);
      return { messages: next };
    }),
  markMessageFailed: (channelId, id) =>
    set((state) => {
      const next = new Map(state.messages);
      const cur = next.get(channelId);
      if (!cur) return {};
      next.set(
        channelId,
        cur.map((x) =>
          x.id === id ? { ...x, __pending: false, __failed: true } : x,
        ),
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
      const selfId = state.user?.id;
      const self = selfId ? map.get(selfId) : undefined;
      return self
        ? { members: next, selfMembers: mirrorSelf(state, guildId, self) }
        : { members: next };
    }),
  upsertMember: (guildId, member) =>
    set((state) => {
      const next = new Map(state.members);
      const cur = next.get(guildId) ?? [];
      const existing = cur.find((m) => m.user?.id === member.user?.id);
      const merged: GuildMember = existing
        ? { ...existing, ...member }
        : member;
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
      return member.user?.id && member.user.id === state.user?.id
        ? { members: next, selfMembers: mirrorSelf(state, guildId, merged) }
        : { members: next };
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
          emoji.id
            ? r.emoji.id === emoji.id
            : !r.emoji.id && r.emoji.name === emoji.name,
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
          emoji.id
            ? r.emoji.id !== emoji.id
            : r.emoji.id || r.emoji.name !== emoji.name,
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
  markReactionPending: (channelId, messageId, emoji, on) =>
    set((state) => {
      const next = new Map(state.messages);
      const cur = next.get(channelId);
      if (!cur) return {};
      const updated = cur.map((msg) => {
        if (msg.id !== messageId) return msg;
        const reactions = (msg.reactions ?? []).map((r) => {
          const match = emoji.id
            ? r.emoji.id === emoji.id
            : !r.emoji.id && r.emoji.name === emoji.name;
          return match ? { ...r, __pending: on } : r;
        });
        return { ...msg, reactions };
      });
      next.set(channelId, updated);
      return { messages: next };
    }),
  setPresences: (guildId, presences) =>
    set((state) => {
      const next = new Map(state.presences);
      const map = new Map<string, Presence>();
      (next.get(guildId) ?? []).forEach((p) => {
        map.set(p.user.id, p);
      });
      presences.forEach((p) => {
        map.set(p.user.id, p);
      });
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
      let expired = false;
      const next = new Map<string, Map<string, number>>();
      state.typing.forEach((inner, k) => {
        const fresh = new Map<string, number>();
        inner.forEach((exp, uid) => {
          if (exp > now) fresh.set(uid, exp);
          else expired = true;
        });
        if (fresh.size) next.set(k, fresh);
      });
      // This runs every 3s. Committing a fresh Map each tick would re-render
      // every typing subscriber for nothing, so only write on a real change.
      if (!expired) return {};
      return { typing: next };
    }),
  hydrateDms: (botId) =>
    set((state) => {
      if (state.dmsHydrated) return {};
      const dms = new Map(state.dms);
      loadStoredDms(botId).forEach((c) => {
        if (!dms.has(c.id)) dms.set(c.id, c);
      });
      markDmsHydrated();
      return { dms, dmsHydrated: true };
    }),
  upsertDm: (c) =>
    set((state) => {
      const prev = state.dms.get(c.id);
      const merged = { ...prev, ...c };
      // Recipients only ride along on the create response, so a later
      // message-derived update must not blank them out.
      if (!c.recipients?.length && prev?.recipients?.length) {
        merged.recipients = prev.recipients;
      }
      const dms = new Map(state.dms);
      dms.set(c.id, merged);
      storeDms(dms.values());
      return { dms };
    }),
  removeDm: (channelId) =>
    set((state) => {
      if (!state.dms.has(channelId)) return {};
      const dms = new Map(state.dms);
      dms.delete(channelId);
      storeDms(dms.values());
      const messages = new Map(state.messages);
      messages.delete(channelId);
      return {
        dms,
        messages,
        channelOrder: state.channelOrder.filter((id) => id !== channelId),
      };
    }),
  bumpUnread: (channelId, mention) =>
    set((state) => {
      if (state.activeChannelId === channelId) return {};
      const unread = new Map(state.unread);
      unread.set(channelId, (unread.get(channelId) ?? 0) + 1);
      if (!mention) return { unread };
      const unreadMentions = new Set(state.unreadMentions);
      unreadMentions.add(channelId);
      return { unread, unreadMentions };
    }),
  setActiveChannel: (channelId) =>
    set((state) =>
      state.activeChannelId === channelId ? {} : { activeChannelId: channelId },
    ),
  reset: () => {
    resetDmStorage();
    set(emptySession());
  },
}));
