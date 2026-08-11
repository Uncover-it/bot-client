"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRealtimeStore } from "@/lib/store";
import {
  ban,
  kick,
  setTimeout as serverTimeout,
  addMemberRole,
  removeMemberRole,
  getGuildMember,
  getUser,
} from "@/api/data/actions";
import {
  activityAssetUrl,
  avatarUrl,
  emojiUrl,
  memberAvatarUrl,
  userBannerUrl,
} from "@/lib/discord/cdn";
import { useGuildPermissions } from "@/hooks/use-permissions";
import { useOpenDm } from "@/hooks/use-open-dm";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { can } from "@/lib/discord/permissions";
import { readableRoleColor } from "@/lib/discord/role-color";
import { STATUS_COLOR } from "@/lib/discord/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Image from "next/image";
import type { Activity, GuildMember, User } from "@/lib/discord/types";
import {
  Ban,
  Check,
  ClockPlus,
  Copy,
  MessageSquare,
  Plus,
  ShieldAlert,
  TimerOff,
  UserRoundMinus,
  X,
} from "lucide-react";

const memberSnapshotCache = new Map<string, GuildMember>();
const userProfileCache = new Map<string, User>();

const STATUS_LABEL: Record<string, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  offline: "Offline",
  invisible: "Invisible",
};

interface Props {
  guildId: string;
  userId: string;
  trigger: ReactNode;
}

let cachedNow = 0;
const nowListeners = new Set<() => void>();
let nowInterval: ReturnType<typeof setInterval> | null = null;

function subscribeNow(cb: () => void): () => void {
  if (cachedNow === 0) cachedNow = Date.now();
  nowListeners.add(cb);
  if (!nowInterval) {
    nowInterval = setInterval(() => {
      cachedNow = Date.now();
      nowListeners.forEach((l) => {
        l();
      });
    }, 30000);
  }
  return () => {
    nowListeners.delete(cb);
    if (nowListeners.size === 0 && nowInterval) {
      clearInterval(nowInterval);
      nowInterval = null;
    }
  };
}
function getNowSnapshot(): number {
  return cachedNow;
}
function getNowServerSnapshot(): number {
  return 0;
}

const TIMEOUT_OPTIONS = [
  { min: 1, label: "60 seconds" },
  { min: 5, label: "5 minutes" },
  { min: 10, label: "10 minutes" },
  { min: 60, label: "1 hour" },
  { min: 1440, label: "1 day" },
  { min: 10080, label: "1 week" },
  { min: 40320, label: "4 weeks" },
];

export function UserProfilePopover({ guildId, userId, trigger }: Props) {
  const cacheKey = `${guildId}:${userId}`;
  const theme = useResolvedTheme();
  const [profile, setProfile] = useState<User | null>(
    () => userProfileCache.get(userId) ?? null,
  );
  const isMobile = useIsMobile();
  const guild = useRealtimeStore((s) => s.guilds.get(guildId));
  const liveMember = useRealtimeStore((s) =>
    (s.members.get(guildId) ?? []).find((m) => m.user?.id === userId),
  );
  const presence = useRealtimeStore((s) =>
    (s.presences.get(guildId) ?? []).find((p) => p.user.id === userId),
  );
  const upsertMember = useRealtimeStore((s) => s.upsertMember);
  const perms = useGuildPermissions(guildId);
  const openDmWith = useOpenDm();
  const [open, setOpen] = useState(false);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const liveHasRoles =
    !!liveMember &&
    Array.isArray(liveMember.roles) &&
    liveMember.roles.length > 0;
  const cachedSnapshot = memberSnapshotCache.get(cacheKey);
  const member: GuildMember | undefined = liveHasRoles
    ? liveMember
    : (cachedSnapshot ?? liveMember);

  useEffect(() => {
    if (liveHasRoles && liveMember) {
      memberSnapshotCache.set(cacheKey, liveMember);
    }
  }, [liveHasRoles, liveMember, cacheKey]);

  const u = member?.user ?? liveMember?.user;
  const name = member?.nick ?? u?.global_name ?? u?.username ?? userId;
  const memberAv = u ? memberAvatarUrl(guildId, u.id, member?.avatar) : null;
  const av = memberAv ?? (u ? avatarUrl(u.id, u.avatar) : "/discord.svg");

  const memberRoles = member?.roles ?? [];
  const allRoles = (guild?.roles ?? []).filter((r) => r.id !== guildId);

  const assignedRoles = allRoles
    .filter((r) => memberRoles.includes(r.id))
    .sort((a, b) => b.position - a.position);

  const availableRoles = allRoles
    .filter((r) => !memberRoles.includes(r.id) && !r.managed)
    .sort((a, b) => b.position - a.position);

  const colorRole = assignedRoles.find((r) => r.color !== 0);
  const accent = colorRole
    ? `#${colorRole.color.toString(16).padStart(6, "0")}`
    : undefined;

  useEffect(() => {
    if (!open || liveHasRoles || !userId) return;
    let alive = true;
    (async () => {
      try {
        const fetched = await getGuildMember(guildId, userId);
        if (!alive || !fetched?.user?.id) return;
        upsertMember(guildId, fetched);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [open, liveHasRoles, guildId, userId, upsertMember]);

  useEffect(() => {
    if (!open || !userId) return;
    if (profile && profile.id === userId) return;
    let alive = true;
    (async () => {
      try {
        const fetched = await getUser(userId);
        if (!alive || !fetched?.id) return;
        userProfileCache.set(userId, fetched);
        setProfile(fetched);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [open, userId, profile]);

  const now = useSyncExternalStore(
    subscribeNow,
    getNowSnapshot,
    getNowServerSnapshot,
  );
  const isTimedOut = member?.communication_disabled_until
    ? new Date(member.communication_disabled_until).getTime() > now
    : false;
  const timeoutEnd =
    isTimedOut && member?.communication_disabled_until
      ? new Date(member.communication_disabled_until)
      : null;

  const canKick = can(perms, "Kick Members") && !u?.bot;
  const canBan = can(perms, "Ban Members") && !u?.bot;
  const canTimeout = can(perms, "Moderate Members") && !u?.bot;
  const canRoles = can(perms, "Manage Roles");

  function timeoutMember(min: number | null) {
    const p = async () => {
      const iso =
        min == null ? null : new Date(Date.now() + min * 60000).toISOString();
      const res = await serverTimeout(guildId, userId, iso);
      if (res?.message) throw new Error(res.message);
      if (res?.user?.id) upsertMember(guildId, res);
    };
    toast.promise(p(), {
      loading: min == null ? "Removing timeout" : "Setting timeout",
      success: min == null ? "Timeout removed" : "Timeout set",
      error: (e) => `Error: ${e.message}`,
    });
  }

  function dropRole(roleId: string) {
    if (!canRoles) return;
    const p = async () => {
      await removeMemberRole(guildId, userId, roleId);
      if (member)
        upsertMember(guildId, {
          ...member,
          roles: memberRoles.filter((r) => r !== roleId),
        });
    };
    toast.promise(p(), {
      loading: "Removing role",
      success: "Role removed",
      error: (e) => `Error: ${e.message}`,
    });
  }

  function pickRole(roleId: string) {
    if (!canRoles) return;
    const p = async () => {
      await addMemberRole(guildId, userId, roleId);
      if (member)
        upsertMember(guildId, { ...member, roles: [...memberRoles, roleId] });
    };
    toast.promise(p(), {
      loading: "Adding role",
      success: "Role added",
      error: (e) => `Error: ${e.message}`,
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side={isMobile ? "bottom" : "left"}
        align={isMobile ? "center" : "start"}
        sideOffset={8}
        collisionPadding={16}
        sticky="partial"
        avoidCollisions
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-80 p-0 overflow-y-auto overflow-x-hidden border-2 max-w-[calc(100vw-2rem)] max-h-[var(--radix-popover-content-available-height)]"
      >
        <TooltipProvider delayDuration={500}>
          {(() => {
            const banner = userBannerUrl(userId, profile?.banner ?? null, 600);
            const fallbackBg = (() => {
              if (profile?.banner_color) return profile.banner_color;
              if (typeof profile?.accent_color === "number") {
                return `#${profile.accent_color.toString(16).padStart(6, "0")}`;
              }
              if (accent) return accent;
              return "linear-gradient(135deg, #4f46e5, #06b6d4)";
            })();
            return (
              <div
                className="relative h-24 overflow-hidden"
                style={banner ? undefined : { background: fallbackBg }}
              >
                {banner && (
                  <Image
                    src={banner}
                    alt=""
                    fill
                    unoptimized
                    sizes="320px"
                    className="object-cover"
                  />
                )}
              </div>
            );
          })()}
          <div className="px-4 pb-4 -mt-10 relative z-10">
            <div className="relative inline-block">
              <Image
                src={av}
                alt={name}
                width={72}
                height={72}
                unoptimized
                className="rounded-full ring-4 ring-popover relative"
              />
              {presence?.status && (
                <span
                  title={STATUS_LABEL[presence.status] ?? presence.status}
                  className={cn(
                    "absolute bottom-0 right-0 size-4 rounded-full ring-[3px] ring-popover",
                    STATUS_COLOR[presence.status] ?? STATUS_COLOR.offline,
                  )}
                />
              )}
            </div>
            <div className="mt-2">
              <div className="font-semibold text-base flex items-center gap-2 flex-wrap">
                <span
                  className="truncate"
                  style={
                    accent
                      ? { color: readableRoleColor(accent, theme) }
                      : undefined
                  }
                >
                  {name}
                </span>
                {u?.bot && (
                  <span className="px-1 rounded bg-blue-500 text-white text-[9px] font-bold">
                    BOT
                  </span>
                )}
                {isTimedOut && (
                  <span className="px-1 rounded bg-red-500/20 text-red-500 text-[9px] font-bold inline-flex items-center gap-0.5">
                    <ClockPlus className="size-2.5" /> TIMED OUT
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground font-mono truncate">
                @{u?.username ?? userId}
              </div>
            </div>
            {presence?.status && (
              <div className="mt-2 text-xs flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-2 rounded-full shrink-0",
                    STATUS_COLOR[presence.status] ?? STATUS_COLOR.offline,
                  )}
                />
                <span className="text-muted-foreground">
                  {STATUS_LABEL[presence.status] ?? presence.status}
                </span>
              </div>
            )}
            {presence?.activities && presence.activities.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {presence.activities.map((act, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: activities have no stable id and the array is replaced whole on every PRESENCE_UPDATE
                  <ActivityCard key={i} activity={act} />
                ))}
              </div>
            )}
            {member?.joined_at && (
              <div className="mt-2 text-xs text-muted-foreground">
                Joined: {new Date(member.joined_at).toLocaleDateString()}
              </div>
            )}
            {timeoutEnd && (
              <div className="mt-1 text-xs text-red-500">
                Timeout ends {timeoutEnd.toLocaleString()}
              </div>
            )}

            <div className="mt-3">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.18em] mb-1 flex items-center justify-between">
                <span>Roles</span>
                {canRoles && availableRoles.length > 0 && (
                  <DropdownMenu
                    open={rolePickerOpen}
                    onOpenChange={setRolePickerOpen}
                  >
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="size-5 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus className="size-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="max-h-60 overflow-y-auto w-56"
                    >
                      <DropdownMenuLabel>Add roles</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {availableRoles.length === 0 ? (
                        <DropdownMenuItem disabled>
                          No more roles
                        </DropdownMenuItem>
                      ) : (
                        availableRoles.map((r) => (
                          <DropdownMenuItem
                            key={r.id}
                            onSelect={(e) => {
                              e.preventDefault();
                              pickRole(r.id);
                            }}
                          >
                            <span
                              className="size-2 rounded-full"
                              style={{
                                background: r.color
                                  ? `#${r.color.toString(16).padStart(6, "0")}`
                                  : "#888",
                              }}
                            />
                            <span className="truncate">{r.name}</span>
                            <Check className="size-3 ml-auto opacity-0" />
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {assignedRoles.length === 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    No roles
                  </span>
                )}
                {assignedRoles.slice(0, 12).map((r) => {
                  const rawHex = r.color
                    ? `#${r.color.toString(16).padStart(6, "0")}`
                    : undefined;
                  const textHex = readableRoleColor(rawHex, theme);
                  return (
                    <span
                      key={r.id}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border"
                      style={{
                        borderColor: textHex ?? "var(--border)",
                        color: textHex ?? "var(--muted-foreground)",
                      }}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{
                          background: rawHex ?? "var(--muted-foreground)",
                        }}
                      />
                      {r.name}
                      {canRoles && !r.managed && (
                        <button
                          type="button"
                          onClick={() => dropRole(r.id)}
                          className="hover:bg-muted rounded-sm -mr-0.5"
                          aria-label={`Remove ${r.name}`}
                        >
                          <X className="size-2.5" />
                        </button>
                      )}
                    </span>
                  );
                })}
                {assignedRoles.length > 12 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{assignedRoles.length - 12}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1 mt-4">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(userId);
                  toast.success("ID copied");
                }}
              >
                <Copy className="size-3 mr-1" /> ID
              </Button>

              {!u?.bot && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    setOpen(false);
                    openDmWith({ id: userId, ...u });
                  }}
                >
                  <MessageSquare className="size-3 mr-1" /> Message
                </Button>
              )}

              {canTimeout && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      <ClockPlus className="size-3 mr-1" /> Timeout
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {isTimedOut && (
                      <>
                        <DropdownMenuItem
                          onSelect={() => timeoutMember(null)}
                          className="text-emerald-500 focus:text-emerald-500"
                        >
                          <TimerOff className="size-3 mr-2" /> Remove timeout
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {TIMEOUT_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.min}
                        onSelect={() => timeoutMember(opt.min)}
                      >
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {isTimedOut && canTimeout && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-emerald-500 border-emerald-500/40"
                  onClick={() => timeoutMember(null)}
                >
                  <TimerOff className="size-3 mr-1" /> Untimeout
                </Button>
              )}

              {canKick && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-destructive border-destructive/50"
                  onClick={() => {
                    toast.promise(kick(guildId, userId), {
                      loading: "Kicking",
                      success: "Kicked",
                      error: (e) => `Error: ${e.message}`,
                    });
                    setOpen(false);
                  }}
                >
                  <UserRoundMinus className="size-3 mr-1" /> Kick
                </Button>
              )}
              {canBan && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-destructive border-destructive/50"
                  onClick={() => {
                    toast.promise(ban(guildId, userId), {
                      loading: "Banning",
                      success: "Banned",
                      error: (e) => `Error: ${e.message}`,
                    });
                    setOpen(false);
                  }}
                >
                  <Ban className="size-3 mr-1" /> Ban
                </Button>
              )}
              {!canKick && !canBan && !canTimeout && !u?.bot && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                      <ShieldAlert className="size-3" /> No mod permissions
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Bot lacks moderation perms in this guild
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </TooltipProvider>
      </PopoverContent>
    </Popover>
  );
}

const ACTIVITY_VERB: Record<number, string> = {
  0: "Playing",
  1: "Streaming",
  2: "Listening to",
  3: "Watching",
  5: "Competing in",
};

function fmtElapsed(start: number, now: number): string {
  const ms = Math.max(0, now - start);
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const h = Math.floor(m / 60);
  if (h > 0)
    return `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")} elapsed`;
  return `${m}:${String(s).padStart(2, "0")} elapsed`;
}

function ActivityCard({ activity }: { activity: Activity }) {
  const now = useSyncExternalStore(
    subscribeNow,
    getNowSnapshot,
    getNowServerSnapshot,
  );

  if (activity.type === 4) {
    const emojiSrc =
      activity.emoji?.id != null
        ? emojiUrl(activity.emoji.id, !!activity.emoji.animated)
        : null;
    return (
      <div className="flex items-center gap-2 text-xs">
        {emojiSrc ? (
          <Image
            src={emojiSrc}
            alt={activity.emoji?.name ?? ""}
            width={18}
            height={18}
            unoptimized
            className="shrink-0"
          />
        ) : activity.emoji?.name ? (
          <span className="text-base leading-none shrink-0">
            {activity.emoji.name}
          </span>
        ) : null}
        <span className="break-words">{activity.state ?? ""}</span>
      </div>
    );
  }

  const verb = ACTIVITY_VERB[activity.type] ?? "Playing";
  const isSpotify = activity.name === "Spotify" || activity.type === 2;
  const largeAsset = activityAssetUrl(
    activity.application_id,
    activity.assets?.large_image,
  );
  const smallAsset = activityAssetUrl(
    activity.application_id,
    activity.assets?.small_image,
  );

  return (
    <div className="rounded-md border bg-muted/30 p-2.5 text-xs">
      <div className="text-[10px] uppercase font-semibold tracking-[0.18em] text-muted-foreground mb-1.5 truncate">
        {verb} {activity.name}
      </div>
      <div className="flex gap-2.5">
        {largeAsset ? (
          <div className="relative size-14 shrink-0">
            <Image
              src={largeAsset}
              alt={activity.assets?.large_text ?? activity.name}
              fill
              unoptimized
              sizes="56px"
              className="rounded object-cover"
            />
            {smallAsset && (
              <Image
                src={smallAsset}
                alt={activity.assets?.small_text ?? ""}
                width={20}
                height={20}
                unoptimized
                className="rounded-full absolute -bottom-1 -right-1 ring-2 ring-popover bg-popover"
              />
            )}
          </div>
        ) : (
          <div
            className={cn(
              "size-14 shrink-0 rounded grid place-items-center text-lg font-bold",
              isSpotify
                ? "bg-[#1DB954] text-black"
                : "bg-muted text-muted-foreground",
            )}
          >
            {isSpotify ? "♪" : activity.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {activity.details && (
            <div className="font-semibold truncate">{activity.details}</div>
          )}
          {activity.state && (
            <div className="truncate text-muted-foreground">
              {activity.state}
            </div>
          )}
          {activity.timestamps?.start &&
            !activity.timestamps?.end &&
            now > 0 && (
              <div className="text-[10px] font-mono text-muted-foreground/80 mt-0.5">
                {fmtElapsed(activity.timestamps.start, now)}
              </div>
            )}
          {activity.timestamps?.start &&
            activity.timestamps?.end &&
            now > 0 && (
              <SpotifyBar
                start={activity.timestamps.start}
                end={activity.timestamps.end}
                now={now}
              />
            )}
        </div>
      </div>
    </div>
  );
}

function SpotifyBar({
  start,
  end,
  now,
}: {
  start: number;
  end: number;
  now: number;
}) {
  const total = Math.max(1, end - start);
  const elapsed = Math.min(total, Math.max(0, now - start));
  const pct = (elapsed / total) * 100;
  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  return (
    <div className="mt-1">
      <div className="h-0.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-foreground/70" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[9px] font-mono text-muted-foreground mt-0.5">
        <span>{fmt(elapsed)}</span>
        <span>{fmt(total)}</span>
      </div>
    </div>
  );
}
