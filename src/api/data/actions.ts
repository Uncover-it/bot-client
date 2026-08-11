"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cacheLife } from "next/cache";
import { checkBotId } from "botid/server";
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

const LIFE = {
  minutes: { stale: 60, revalidate: 60, expire: 300 },
  hours: { stale: 300, revalidate: 3600, expire: 86400 },
} as const;

/** Build an Error carrying Discord's own message when it sent one. */
async function discordError(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => null)) as {
    message?: string;
  } | null;
  return new Error(body?.message ?? `${fallback} (HTTP ${res.status})`);
}

async function cachedFetch(t: string, path: string, life: keyof typeof LIFE) {
  "use cache";
  cacheLife(LIFE[life]);
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bot ${t}` },
  });
  // Throw rather than return null: a returned value gets committed to the
  // cache, so one transient 429/5xx would pin this path to "empty" for the
  // whole revalidate window. Throwing leaves the entry uncached and lets the
  // next call retry.
  if (!res.ok) throw await discordError(res, `GET ${path} failed`);
  return res.json();
}

/** Cached GET. Failures come back as null and are not cached. */
async function cachedJson(t: string, path: string, life: keyof typeof LIFE) {
  try {
    return await cachedFetch(t, path, life);
  } catch {
    return null;
  }
}

async function ensureHuman() {
  const v = await checkBotId();
  if (v.isBot) throw new Error("Access denied");
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
  const t = await token();
  const guilds = (await cachedJson(t, "/users/@me/guilds", "minutes")) as
    | RawGuild[]
    | null;
  return Array.isArray(guilds) ? guilds : [];
}

export async function getGuild(guildId: string) {
  const t = await token();
  return cachedJson(t, `/guilds/${guildId}?with_counts=true`, "minutes");
}

export async function getGuildRoles(guildId: string) {
  const t = await token();
  return cachedJson(t, `/guilds/${guildId}/roles`, "minutes");
}

export async function getGuildChannels(guildId: string) {
  const t = await token();
  return cachedJson(t, `/guilds/${guildId}/channels`, "minutes");
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

export async function searchGuildMembers(
  guildId: string,
  query: string,
  limit = 8,
) {
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
  const t = await token();
  return cachedJson(t, `/users/${userId}`, "hours");
}

export async function getAuditLog(
  guildId: string,
  options?: {
    limit?: number;
    before?: string;
    actionType?: number;
    userId?: string;
  },
) {
  const params = new URLSearchParams();
  params.set("limit", String(options?.limit ?? 50));
  if (options?.before) params.set("before", options.before);
  if (options?.actionType !== undefined)
    params.set("action_type", String(options.actionType));
  if (options?.userId) params.set("user_id", options.userId);
  const res = await authed(
    `/guilds/${guildId}/audit-logs?${params.toString()}`,
    {
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.message ?? `HTTP ${res.status}` };
  }
  return res.json();
}

export async function getChannelWebhooks(channelId: string) {
  const res = await authed(`/channels/${channelId}/webhooks`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.message ?? `HTTP ${res.status}` };
  }
  return res.json();
}

export async function createWebhook(
  channelId: string,
  name: string,
  avatar?: string | null,
) {
  await ensureHuman();
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
  await ensureHuman();
  const res = await authed(`/webhooks/${webhookId}`, { method: "DELETE" });
  if (!res.ok) throw await discordError(res, "Failed to delete webhook");
  return { ok: true };
}

export async function updateBotInfo(
  data: Partial<{
    username: string;
    avatar: string | null;
    banner: string | null;
  }>,
) {
  await ensureHuman();
  const res = await authed("/users/@me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getCurrentApplication() {
  const t = await token();
  return cachedJson(t, "/applications/@me", "hours");
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
  await ensureHuman();
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
  await ensureHuman();
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
  nonce?: string,
) {
  await ensureHuman();
  const t = await token();
  const ref = replyTo
    ? { message_reference: { message_id: replyTo, fail_if_not_exists: false } }
    : {};
  const nonceField = nonce ? { nonce, enforce_nonce: true } : {};

  if (!files || files.length === 0) {
    const payload: Record<string, unknown> = { tts, ...ref, ...nonceField };
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
  const payload: Record<string, unknown> = {
    content: text ?? "",
    tts,
    ...ref,
    ...nonceField,
  };
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

export async function editMessage(
  channelId: string,
  messageId: string,
  content: string,
) {
  await ensureHuman();
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
  if (!res.ok) throw await discordError(res, "Failed to load messages");
  return res.json();
}

export async function setTimeout(
  serverId: string,
  userId: string,
  duration: string | null,
) {
  await ensureHuman();
  const res = await authed(`/guilds/${serverId}/members/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ communication_disabled_until: duration }),
  });
  return res.json();
}

export async function kick(serverId: string, userId: string) {
  await ensureHuman();
  const res = await authed(`/guilds/${serverId}/members/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw await discordError(res, "Failed to kick member");
  return { ok: true };
}

export async function ban(
  serverId: string,
  userId: string,
  deleteMessageDays = 0,
) {
  await ensureHuman();
  const res = await authed(`/guilds/${serverId}/bans/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delete_message_seconds: deleteMessageDays * 86400 }),
  });
  if (!res.ok) throw await discordError(res, "Failed to ban member");
  return { ok: true };
}

export async function unban(serverId: string, userId: string) {
  await ensureHuman();
  const res = await authed(`/guilds/${serverId}/bans/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw await discordError(res, "Failed to unban member");
  return { ok: true };
}

export async function getGuildBans(serverId: string, limit = 100) {
  const res = await authed(`/guilds/${serverId}/bans?limit=${limit}`, {
    cache: "no-store",
  });
  return res.json();
}

export async function addMemberRole(
  guildId: string,
  userId: string,
  roleId: string,
) {
  await ensureHuman();
  const res = await authed(
    `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    {
      method: "PUT",
    },
  );
  if (!res.ok) throw await discordError(res, "Failed to add role");
  return { ok: true };
}

export async function removeMemberRole(
  guildId: string,
  userId: string,
  roleId: string,
) {
  await ensureHuman();
  const res = await authed(
    `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    {
      method: "DELETE",
    },
  );
  if (!res.ok) throw await discordError(res, "Failed to remove role");
  return { ok: true };
}

export async function getActiveThreads(guildId: string) {
  const res = await authed(`/guilds/${guildId}/threads/active`, {
    cache: "no-store",
  });
  return res.json();
}

export async function getChannel(channelId: string) {
  const t = await token();
  return cachedJson(t, `/channels/${channelId}`, "minutes");
}

export async function deleteMessage(channelId: string, messageId: string) {
  await ensureHuman();
  const res = await authed(`/channels/${channelId}/messages/${messageId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw await discordError(res, "Failed to delete message");
  return { ok: true };
}

export async function pinMessage(channelId: string, messageId: string) {
  await ensureHuman();
  const res = await authed(`/channels/${channelId}/pins/${messageId}`, {
    method: "PUT",
  });
  if (!res.ok) throw await discordError(res, "Failed to pin message");
  return { ok: true };
}

export async function unpinMessage(channelId: string, messageId: string) {
  await ensureHuman();
  const res = await authed(`/channels/${channelId}/pins/${messageId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw await discordError(res, "Failed to unpin message");
  return { ok: true };
}

export async function getStickers(serverId: string) {
  const t = await token();
  return cachedJson(t, `/guilds/${serverId}/stickers`, "hours");
}

export async function createChannel(
  guildId: string,
  data: { name: string; type: number; topic?: string; parent_id?: string },
) {
  await ensureHuman();
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
  await ensureHuman();
  const res = await authed(`/channels/${channelId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteChannel(channelId: string) {
  await ensureHuman();
  const res = await authed(`/channels/${channelId}`, { method: "DELETE" });
  if (!res.ok) throw await discordError(res, "Failed to delete channel");
  return { ok: true };
}

export async function triggerTyping(channelId: string) {
  await authed(`/channels/${channelId}/typing`, { method: "POST" });
}

export async function updateGuild(
  guildId: string,
  data: Partial<{ name: string; description: string }>,
) {
  await ensureHuman();
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
  data: Partial<{
    name: string;
    color: number;
    hoist: boolean;
    mentionable: boolean;
    permissions: string;
  }>,
) {
  await ensureHuman();
  const res = await authed(`/guilds/${guildId}/roles/${roleId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function createRole(
  guildId: string,
  data: Partial<{
    name: string;
    color: number;
    hoist: boolean;
    mentionable: boolean;
    permissions: string;
  }>,
) {
  await ensureHuman();
  const res = await authed(`/guilds/${guildId}/roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteRole(guildId: string, roleId: string) {
  await ensureHuman();
  const res = await authed(`/guilds/${guildId}/roles/${roleId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw await discordError(res, "Failed to delete role");
  return { ok: true };
}

export async function getGuildEmojis(guildId: string) {
  const t = await token();
  return cachedJson(t, `/guilds/${guildId}/emojis`, "hours");
}

export async function addReaction(
  channelId: string,
  messageId: string,
  emoji: string,
) {
  const res = await authed(
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
    { method: "PUT" },
  );
  if (!res.ok) throw await discordError(res, "Failed to add reaction");
  return { ok: true };
}

export async function removeReaction(
  channelId: string,
  messageId: string,
  emoji: string,
) {
  const res = await authed(
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
    { method: "DELETE" },
  );
  if (!res.ok) throw await discordError(res, "Failed to remove reaction");
  return { ok: true };
}

/**
 * Who reacted with one emoji. Paginated by user id: pass the last id back as
 * `after` to walk past the first page.
 */
export async function getReactionUsers(
  channelId: string,
  messageId: string,
  emoji: string,
  options?: { limit?: number; after?: string },
) {
  const qs = new URLSearchParams({ limit: String(options?.limit ?? 25) });
  if (options?.after) qs.set("after", options.after);
  const res = await authed(
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}?${qs}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw await discordError(res, "Failed to load reactions");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Deletes every reaction of one emoji. Needs Manage Messages. */
export async function clearReactionEmoji(
  channelId: string,
  messageId: string,
  emoji: string,
) {
  await ensureHuman();
  const res = await authed(
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw await discordError(res, "Failed to clear reaction");
  return { ok: true };
}

/**
 * Opens (or re-opens) a DM with a user and returns the channel. Discord has no
 * endpoint that lists a bot's DMs, so the client remembers what this returns.
 */
export async function openDm(recipientId: string) {
  await ensureHuman();
  const res = await authed("/users/@me/channels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_id: recipientId }),
  });
  if (!res.ok) throw await discordError(res, "Failed to open DM");
  return res.json();
}
