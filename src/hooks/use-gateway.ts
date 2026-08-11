"use client";

import { useEffect, useRef } from "react";
import { DiscordGateway } from "@/lib/discord/gateway";
import { CHANNEL_TYPE } from "@/lib/discord/constants";
import { useRealtimeStore } from "@/lib/store";
import type {
  Channel,
  Guild,
  GuildMember,
  Message,
  Presence,
  Role,
} from "@/lib/discord/types";

let singleton: DiscordGateway | null = null;

export function getGateway() {
  return singleton;
}

const memberBuffer = new Map<string, GuildMember[]>();
const presenceBuffer = new Map<string, Presence[]>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const s = useRealtimeStore.getState();
    memberBuffer.forEach((arr, gid) => {
      if (arr.length) s.setMembers(gid, arr);
    });
    memberBuffer.clear();
    presenceBuffer.forEach((arr, gid) => {
      if (arr.length) s.setPresences(gid, arr);
    });
    presenceBuffer.clear();
  }, 150);
}

function bufferMembers(guildId: string, members: GuildMember[]) {
  const cur = memberBuffer.get(guildId) ?? [];
  cur.push(...members);
  memberBuffer.set(guildId, cur);
  scheduleFlush();
}

function bufferPresences(guildId: string, presences: Presence[]) {
  const cur = presenceBuffer.get(guildId) ?? [];
  cur.push(...presences);
  presenceBuffer.set(guildId, cur);
  scheduleFlush();
}

function discardBuffers() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  memberBuffer.clear();
  presenceBuffer.clear();
}

export function useGateway(token: string | null) {
  const started = useRef(false);
  const store = useRealtimeStore;

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    // The DM list is client-side memory, not something Discord will send.
    store.getState().hydrateDms();

    const gw = new DiscordGateway({
      token,
      onState: (s) => store.getState().setGatewayState(s),
      onPing: (ms) => store.getState().setPing(ms),
      onIntents: (n) => store.getState().setActiveIntents(n),
      onDispatch: (event, data) => handleDispatch(event, data),
    });
    singleton = gw;
    gw.connect();

    const prune = setInterval(() => store.getState().pruneTyping(), 3000);

    const onVisibility = () => {
      if (document.hidden) return;
      const state = gw.getState();
      if (state === "ready") return;
      gw.reconnectNow();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);

    return () => {
      clearInterval(prune);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
      gw.disconnect();
      // These live at module scope; a pending flush would otherwise write to
      // the store after teardown.
      discardBuffers();
      singleton = null;
      started.current = false;
    };
    // `store` is the Zustand hook itself, a stable module-level reference.
  }, [token]);
}

/**
 * Records the DM a message arrived in. Bots cannot list their DMs, so the
 * only reliable way to learn about an inbound one is the message itself: the
 * author is the recipient.
 */
function rememberDm(m: Message) {
  const store = useRealtimeStore.getState();
  const me = store.user?.id;
  if (m.author.id === me) return;
  store.upsertDm({
    id: m.channel_id,
    type: CHANNEL_TYPE.DM,
    recipients: [m.author],
    last_message_id: m.id,
  });
}

function handleDispatch(event: string, data: unknown) {
  const s = useRealtimeStore.getState();
  switch (event) {
    case "READY": {
      const d = data as {
        user: { id: string; username: string; avatar?: string | null };
        guilds: { id: string; unavailable: boolean }[];
      };
      s.setUser({ ...d.user, discriminator: "0" });
      break;
    }
    case "GUILD_CREATE": {
      const g = data as Guild;
      s.upsertGuild(g);
      if (g.members?.length) bufferMembers(g.id, g.members);
      if (g.presences?.length) bufferPresences(g.id, g.presences);
      break;
    }
    case "GUILD_UPDATE": {
      s.upsertGuild(data as Guild);
      break;
    }
    case "GUILD_DELETE": {
      const d = data as { id: string };
      const cur = useRealtimeStore.getState().guilds;
      const next = new Map(cur);
      next.delete(d.id);
      useRealtimeStore.setState({ guilds: next });
      break;
    }
    case "CHANNEL_CREATE":
    case "CHANNEL_UPDATE": {
      s.upsertChannel(data as Channel);
      break;
    }
    case "CHANNEL_DELETE": {
      const c = data as Channel;
      if (c.type === CHANNEL_TYPE.DM || c.type === CHANNEL_TYPE.GROUP_DM) {
        s.removeDm(c.id);
        break;
      }
      s.removeChannel(c.id, c.guild_id);
      break;
    }
    case "GUILD_ROLE_CREATE":
    case "GUILD_ROLE_UPDATE": {
      const d = data as { guild_id: string; role: Role };
      const g = useRealtimeStore.getState().guilds.get(d.guild_id);
      const roles = (g?.roles ?? [])
        .filter((r) => r.id !== d.role.id)
        .concat(d.role);
      s.setRoles(d.guild_id, roles);
      break;
    }
    case "GUILD_ROLE_DELETE": {
      const d = data as { guild_id: string; role_id: string };
      const g = useRealtimeStore.getState().guilds.get(d.guild_id);
      const roles = (g?.roles ?? []).filter((r) => r.id !== d.role_id);
      s.setRoles(d.guild_id, roles);
      break;
    }
    case "GUILD_MEMBER_ADD":
    case "GUILD_MEMBER_UPDATE": {
      const d = data as GuildMember & { guild_id: string };
      s.upsertMember(d.guild_id, d);
      break;
    }
    case "GUILD_MEMBER_REMOVE": {
      const d = data as { guild_id: string; user: { id: string } };
      s.removeMember(d.guild_id, d.user.id);
      break;
    }
    case "GUILD_MEMBERS_CHUNK": {
      const d = data as {
        guild_id: string;
        members: GuildMember[];
        presences?: Presence[];
      };
      if (d.members.length) bufferMembers(d.guild_id, d.members);
      if (d.presences?.length) bufferPresences(d.guild_id, d.presences);
      break;
    }
    case "PRESENCE_UPDATE": {
      const d = data as Presence & { guild_id: string };
      bufferPresences(d.guild_id, [d]);
      break;
    }
    case "MESSAGE_CREATE": {
      const m = data as Message;
      // A DM the bot has never seen only announces itself through its first
      // message, so synthesize the channel from the author.
      if (!m.guild_id) rememberDm(m);
      s.addMessage(m);
      const me = useRealtimeStore.getState().user?.id;
      if (me && m.author.id !== me) {
        const mention =
          !m.guild_id ||
          (m.mentions ?? []).some((u) => u.id === me) ||
          m.referenced_message?.author?.id === me;
        s.bumpUnread(m.channel_id, mention);
      }
      break;
    }
    case "MESSAGE_UPDATE": {
      s.updateMessage(data as Message);
      break;
    }
    case "MESSAGE_DELETE": {
      const d = data as { id: string; channel_id: string };
      s.removeMessage(d.channel_id, d.id);
      break;
    }
    case "MESSAGE_DELETE_BULK": {
      const d = data as { ids: string[]; channel_id: string };
      d.ids.forEach((id) => {
        s.removeMessage(d.channel_id, id);
      });
      break;
    }
    case "TYPING_START": {
      const d = data as { channel_id: string; user_id: string };
      s.setTyping(d.channel_id, d.user_id);
      break;
    }
    case "MESSAGE_REACTION_ADD": {
      const d = data as {
        user_id: string;
        channel_id: string;
        message_id: string;
        emoji: { id?: string | null; name?: string | null; animated?: boolean };
      };
      const me = useRealtimeStore.getState().user?.id;
      s.addReaction(d.channel_id, d.message_id, d.emoji, d.user_id === me);
      break;
    }
    case "MESSAGE_REACTION_REMOVE": {
      const d = data as {
        user_id: string;
        channel_id: string;
        message_id: string;
        emoji: { id?: string | null; name?: string | null };
      };
      const me = useRealtimeStore.getState().user?.id;
      s.removeReaction(d.channel_id, d.message_id, d.emoji, d.user_id === me);
      break;
    }
    case "MESSAGE_REACTION_REMOVE_ALL": {
      const d = data as { channel_id: string; message_id: string };
      s.removeAllReactions(d.channel_id, d.message_id);
      break;
    }
    case "MESSAGE_REACTION_REMOVE_EMOJI": {
      const d = data as {
        channel_id: string;
        message_id: string;
        emoji: { id?: string | null; name?: string | null };
      };
      s.removeReactionEmoji(d.channel_id, d.message_id, d.emoji);
      break;
    }
  }
}
