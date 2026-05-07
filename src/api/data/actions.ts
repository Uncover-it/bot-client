"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_BASE } from "@/lib/discord/constants";

async function token(): Promise<string> {
  const c = await cookies();
  const t = c.get("token")?.value;
  if (!t) throw new Error("No token");
  return t;
}

async function authed(path: string, init: RequestInit = {}): Promise<Response> {
  const t = await token();
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bot ${t}`,
    },
  });
}

export async function logout() {
  const c = await cookies();
  c.delete("token");
  redirect("/");
}

export async function getBotInfo() {
  const res = await authed("/users/@me", { cache: "no-store" });
  return res.json();
}

interface RawGuild {
  id: string;
  name: string;
  icon: string | null;
  permissions: string;
  features: string[];
}

export async function getServers() {
  const guildsRes = await authed("/users/@me/guilds", { cache: "no-store" });
  const guilds: RawGuild[] = await guildsRes.json();
  if (!Array.isArray(guilds)) return [];

  const withChannels = await Promise.all(
    guilds.map(async (g) => {
      const cRes = await authed(`/guilds/${g.id}/channels`, {
        next: { revalidate: 60 },
      });
      const channels = cRes.ok ? await cRes.json() : [];
      return { ...g, channels };
    }),
  );
  return withChannels;
}

export async function getGuild(guildId: string) {
  const res = await authed(`/guilds/${guildId}?with_counts=true`, {
    next: { revalidate: 30 },
  });
  return res.json();
}

export async function getGuildRoles(guildId: string) {
  const res = await authed(`/guilds/${guildId}/roles`, {
    next: { revalidate: 30 },
  });
  return res.json();
}

export async function getGuildChannels(guildId: string) {
  const res = await authed(`/guilds/${guildId}/channels`, {
    next: { revalidate: 30 },
  });
  return res.json();
}

export async function getGuildMembers(guildId: string, limit = 1000) {
  const res = await authed(`/guilds/${guildId}/members?limit=${limit}`, {
    cache: "no-store",
  });
  return res.json();
}

export async function getGuildMember(guildId: string, userId: string) {
  const res = await authed(`/guilds/${guildId}/members/${userId}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export async function searchGuildMembers(guildId: string, query: string, limit = 8) {
  const q = query.trim();
  if (!q) return [];
  const res = await authed(
    `/guilds/${guildId}/members/search?query=${encodeURIComponent(q)}&limit=${limit}`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function getUser(userId: string) {
  const res = await authed(`/users/${userId}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function getAuditLog(
  guildId: string,
  options?: { limit?: number; before?: string; actionType?: number; userId?: string },
) {
  const params = new URLSearchParams();
  params.set("limit", String(options?.limit ?? 50));
  if (options?.before) params.set("before", options.before);
  if (options?.actionType !== undefined) params.set("action_type", String(options.actionType));
  if (options?.userId) params.set("user_id", options.userId);
  const res = await authed(`/guilds/${guildId}/audit-logs?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.message ?? `HTTP ${res.status}` };
  }
  return res.json();
}

export async function getChannelWebhooks(channelId: string) {
  const res = await authed(`/channels/${channelId}/webhooks`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.message ?? `HTTP ${res.status}` };
  }
  return res.json();
}

export async function createWebhook(channelId: string, name: string, avatar?: string | null) {
  const body: Record<string, unknown> = { name };
  if (avatar !== undefined) body.avatar = avatar;
  const res = await authed(`/channels/${channelId}/webhooks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function deleteWebhook(webhookId: string) {
  const res = await authed(`/webhooks/${webhookId}`, { method: "DELETE" });
  if (res.status === 204) return { ok: true };
  return res.json().catch(() => ({ ok: false }));
}

export async function updateWebhook(
  webhookId: string,
  data: Partial<{ name: string; avatar: string | null; channel_id: string }>,
) {
  const res = await authed(`/webhooks/${webhookId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateBotInfo(
  data: Partial<{ username: string; avatar: string | null; banner: string | null }>,
) {
  const res = await authed("/users/@me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getCurrentApplication() {
  const res = await authed("/applications/@me", { cache: "no-store" });
  return res.json();
}

export async function updateApplication(
  data: Partial<{
    description: string;
    icon: string | null;
    cover_image: string | null;
    interactions_endpoint_url: string | null;
    tags: string[];
  }>,
) {
  const res = await authed("/applications/@me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getInviteCode(
  id: string | number | undefined,
  options?: { maxAge?: number; maxUses?: number; unique?: boolean },
) {
  if (!id) return null;
  const res = await authed(`/channels/${id}/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      max_age: options?.maxAge ?? 3600,
      max_uses: options?.maxUses ?? 1,
      unique: options?.unique ?? true,
    }),
  });
  const data = await res.json();
  return data.code;
}

export async function sendMessage(
  channelId: string,
  tts: boolean,
  text?: string,
  files?: (File | { name?: string; type?: string; data?: ArrayBuffer })[],
  stickerId?: string,
  replyTo?: string,
) {
  const t = await token();
  const ref = replyTo
    ? { message_reference: { message_id: replyTo, fail_if_not_exists: false } }
    : {};

  if (!files || files.length === 0) {
    const payload: Record<string, unknown> = { tts, ...ref };
    if (text) payload.content = text;
    if (stickerId) payload.sticker_ids = [stickerId];

    const res = await fetch(`${API_BASE}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  const form = new FormData();
  const payload: Record<string, unknown> = { content: text ?? "", tts, ...ref };
  if (stickerId) payload.sticker_ids = [stickerId];
  form.append("payload_json", JSON.stringify(payload));

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (typeof (f as File)?.stream === "function" || f instanceof Blob) {
      form.append(`files[${i}]`, f as File, (f as File).name || `file-${i}`);
    } else if (f && "data" in f && f.data) {
      const blob = new Blob([f.data], {
        type: f.type || "application/octet-stream",
      });
      form.append(`files[${i}]`, blob, f.name || `file-${i}`);
    }
  }

  const res = await fetch(`${API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${t}` },
    body: form,
  });
  return res.json();
}

export async function editMessage(channelId: string, messageId: string, content: string) {
  const res = await authed(`/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return res.json();
}

export async function getMessages(channelId: string, before?: string) {
  const qs = new URLSearchParams({ limit: "50" });
  if (before) qs.set("before", before);
  const res = await authed(`/channels/${channelId}/messages?${qs}`, {
    cache: "no-store",
  });
  return res.json();
}

export async function pingRest() {
  const start = Date.now();
  await authed("/gateway", { cache: "no-store" });
  return Date.now() - start;
}

export async function setTimeout(
  serverId: string,
  userId: string,
  duration: string | null,
) {
  const res = await authed(`/guilds/${serverId}/members/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ communication_disabled_until: duration }),
  });
  return res.json();
}

export async function kick(serverId: string, userId: string) {
  const res = await authed(`/guilds/${serverId}/members/${userId}`, { method: "DELETE" });
  return res.ok ? { ok: true } : res.json();
}

export async function ban(serverId: string, userId: string, deleteMessageDays = 0) {
  const res = await authed(`/guilds/${serverId}/bans/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delete_message_seconds: deleteMessageDays * 86400 }),
  });
  return res.ok ? { ok: true } : res.json();
}

export async function unban(serverId: string, userId: string) {
  const res = await authed(`/guilds/${serverId}/bans/${userId}`, { method: "DELETE" });
  return res.ok ? { ok: true } : res.json();
}

export async function getGuildBans(serverId: string, limit = 100) {
  const res = await authed(`/guilds/${serverId}/bans?limit=${limit}`, { cache: "no-store" });
  return res.json();
}

export async function addMemberRole(guildId: string, userId: string, roleId: string) {
  const res = await authed(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: "PUT",
  });
  return res.ok ? { ok: true } : res.json();
}

export async function removeMemberRole(guildId: string, userId: string, roleId: string) {
  const res = await authed(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: "DELETE",
  });
  return res.ok ? { ok: true } : res.json();
}

export async function getActiveThreads(guildId: string) {
  const res = await authed(`/guilds/${guildId}/threads/active`, { cache: "no-store" });
  return res.json();
}

export async function getChannel(channelId: string) {
  const res = await authed(`/channels/${channelId}`, { cache: "no-store" });
  return res.json();
}

export async function deleteMessage(channelId: string, messageId: string) {
  return authed(`/channels/${channelId}/messages/${messageId}`, { method: "DELETE" });
}

export async function pinMessage(channelId: string, messageId: string) {
  const res = await authed(`/channels/${channelId}/pins/${messageId}`, { method: "PUT" });
  return res.ok ? { ok: true } : res.json();
}

export async function unpinMessage(channelId: string, messageId: string) {
  const res = await authed(`/channels/${channelId}/pins/${messageId}`, { method: "DELETE" });
  return res.ok ? { ok: true } : res.json();
}

export async function getStickers(serverId: string) {
  const res = await authed(`/guilds/${serverId}/stickers`, {
    next: { revalidate: 120 },
  });
  return res.json();
}

export async function createChannel(
  guildId: string,
  data: { name: string; type: number; topic?: string; parent_id?: string },
) {
  const res = await authed(`/guilds/${guildId}/channels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateChannel(
  channelId: string,
  data: Partial<{
    name: string;
    topic: string;
    nsfw: boolean;
    rate_limit_per_user: number;
    bitrate: number;
    user_limit: number;
    default_auto_archive_duration: number;
    default_thread_rate_limit_per_user: number;
    position: number;
    parent_id: string | null;
  }>,
) {
  const res = await authed(`/channels/${channelId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteChannel(channelId: string) {
  const res = await authed(`/channels/${channelId}`, { method: "DELETE" });
  return res.ok ? { ok: true } : res.json();
}

export async function triggerTyping(channelId: string) {
  await authed(`/channels/${channelId}/typing`, { method: "POST" });
}

export async function updateGuild(
  guildId: string,
  data: Partial<{ name: string; description: string }>,
) {
  const res = await authed(`/guilds/${guildId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateRole(
  guildId: string,
  roleId: string,
  data: Partial<{ name: string; color: number; hoist: boolean; mentionable: boolean; permissions: string }>,
) {
  const res = await authed(`/guilds/${guildId}/roles/${roleId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function createRole(
  guildId: string,
  data: Partial<{ name: string; color: number; hoist: boolean; mentionable: boolean; permissions: string }>,
) {
  const res = await authed(`/guilds/${guildId}/roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteRole(guildId: string, roleId: string) {
  const res = await authed(`/guilds/${guildId}/roles/${roleId}`, { method: "DELETE" });
  return res.ok ? { ok: true } : res.json();
}

export async function getGuildEmojis(guildId: string) {
  const res = await authed(`/guilds/${guildId}/emojis`, {
    next: { revalidate: 120 },
  });
  return res.json();
}

export async function addReaction(channelId: string, messageId: string, emoji: string) {
  await authed(
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
    { method: "PUT" },
  );
}

export async function removeReaction(channelId: string, messageId: string, emoji: string) {
  await authed(
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
    { method: "DELETE" },
  );
}
