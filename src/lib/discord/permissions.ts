import { PERMISSIONS } from "./constants";
import type { Channel, Guild } from "./types";

export function hasPermission(
  permissions: string | bigint,
  perm: keyof typeof PERMISSIONS,
): boolean {
  const p = typeof permissions === "string" ? BigInt(permissions) : permissions;
  return (p & PERMISSIONS[perm]) !== 0n;
}

export function listPermissions(permissions: string | bigint): string[] {
  const p = typeof permissions === "string" ? BigInt(permissions) : permissions;
  return Object.keys(PERMISSIONS).filter((k) => (p & PERMISSIONS[k]) !== 0n);
}

export function hasAdmin(permissions: string | bigint): boolean {
  return hasPermission(permissions, "Administrator");
}

export function bigOr(...vals: (string | bigint | undefined | null)[]): bigint {
  let acc = 0n;
  for (const v of vals) {
    if (v == null) continue;
    acc |= typeof v === "string" ? BigInt(v) : v;
  }
  return acc;
}

export function effectiveGuildPermissions(guild: Guild | undefined): bigint {
  if (!guild) return 0n;
  if (guild.permissions) return BigInt(guild.permissions);
  return 0n;
}

export function computeChannelPermissions(
  basePerms: bigint,
  channel: Channel | undefined,
  botRoles: string[] = [],
  botUserId?: string,
  guildId?: string,
): bigint {
  if (!channel || !channel.permission_overwrites) return basePerms;
  if ((basePerms & PERMISSIONS.Administrator) !== 0n) return basePerms;

  let perms = basePerms;

  const everyone = channel.permission_overwrites.find((o) => o.id === guildId);
  if (everyone) {
    perms &= ~BigInt(everyone.deny);
    perms |= BigInt(everyone.allow);
  }

  let allow = 0n;
  let deny = 0n;
  for (const o of channel.permission_overwrites) {
    if (o.type === 0 && botRoles.includes(o.id)) {
      allow |= BigInt(o.allow);
      deny |= BigInt(o.deny);
    }
  }
  perms &= ~deny;
  perms |= allow;

  if (botUserId) {
    const member = channel.permission_overwrites.find(
      (o) => o.type === 1 && o.id === botUserId,
    );
    if (member) {
      perms &= ~BigInt(member.deny);
      perms |= BigInt(member.allow);
    }
  }

  return perms;
}

export function can(perms: bigint, perm: keyof typeof PERMISSIONS): boolean {
  if ((perms & PERMISSIONS.Administrator) !== 0n) return true;
  return (perms & PERMISSIONS[perm]) !== 0n;
}
