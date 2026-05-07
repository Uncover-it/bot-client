import { CDN_BASE } from "./constants";

export function avatarUrl(userId: string, hash?: string | null, size = 128): string {
  if (!hash) {
    const idx = (BigInt(userId) >> 22n) % 6n;
    return `${CDN_BASE}/embed/avatars/${idx}.png`;
  }
  const ext = hash.startsWith("a_") ? "gif" : "png";
  return `${CDN_BASE}/avatars/${userId}/${hash}.${ext}?size=${size}`;
}

export function memberAvatarUrl(
  guildId: string,
  userId: string,
  hash?: string | null,
  size = 128,
): string | null {
  if (!hash) return null;
  const ext = hash.startsWith("a_") ? "gif" : "png";
  return `${CDN_BASE}/guilds/${guildId}/users/${userId}/avatars/${hash}.${ext}?size=${size}`;
}

export function guildIconUrl(guildId: string, hash?: string | null, size = 128): string | null {
  if (!hash) return null;
  const ext = hash.startsWith("a_") ? "gif" : "png";
  return `${CDN_BASE}/icons/${guildId}/${hash}.${ext}?size=${size}`;
}

export function guildBannerUrl(guildId: string, hash?: string | null, size = 512): string | null {
  if (!hash) return null;
  const ext = hash.startsWith("a_") ? "gif" : "png";
  return `${CDN_BASE}/banners/${guildId}/${hash}.${ext}?size=${size}`;
}

export function emojiUrl(id: string, animated = false): string {
  return `${CDN_BASE}/emojis/${id}.${animated ? "gif" : "png"}`;
}

export function stickerUrl(id: string, formatType: number): string {
  if (formatType === 1 || formatType === 2) return `${CDN_BASE}/stickers/${id}.png?size=64`;
  return `${CDN_BASE}/stickers/${id}?size=64`;
}

export function roleIconUrl(roleId: string, hash?: string | null): string | null {
  if (!hash) return null;
  return `${CDN_BASE}/role-icons/${roleId}/${hash}.png`;
}
