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

export function userBannerUrl(
  userId: string,
  hash?: string | null,
  size = 600,
): string | null {
  if (!hash) return null;
  const ext = hash.startsWith("a_") ? "gif" : "png";
  return `${CDN_BASE}/banners/${userId}/${hash}.${ext}?size=${size}`;
}

export function guildIconUrl(guildId: string, hash?: string | null, size = 128): string | null {
  if (!hash) return null;
  const ext = hash.startsWith("a_") ? "gif" : "png";
  return `${CDN_BASE}/icons/${guildId}/${hash}.${ext}?size=${size}`;
}

export function emojiUrl(id: string, animated = false): string {
  return `${CDN_BASE}/emojis/${id}.${animated ? "gif" : "png"}`;
}

export function stickerUrl(id: string, formatType: number, size = 64): string {
  if (formatType === 4) return `https://media.discordapp.net/stickers/${id}.gif`;
  if (formatType === 1 || formatType === 2) return `${CDN_BASE}/stickers/${id}.png?size=${size}`;
  return `${CDN_BASE}/stickers/${id}.json`;
}

export function activityAssetUrl(
  applicationId: string | undefined,
  asset: string | undefined,
): string | null {
  if (!asset) return null;
  if (asset.startsWith("mp:external/")) {
    const path = asset.replace(/^mp:/, "");
    return `https://media.discordapp.net/${path}`;
  }
  if (asset.startsWith("spotify:")) {
    return `https://i.scdn.co/image/${asset.slice("spotify:".length)}`;
  }
  if (asset.startsWith("twitch:")) {
    const username = asset.slice("twitch:".length);
    return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${username}.png`;
  }
  if (asset.startsWith("youtube:")) {
    return `https://i.ytimg.com/vi/${asset.slice("youtube:".length)}/hqdefault.jpg`;
  }
  if (!applicationId) return null;
  return `${CDN_BASE}/app-assets/${applicationId}/${asset}.png`;
}
