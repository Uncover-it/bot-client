"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
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
} from "@/api/data/actions";
import { avatarUrl, memberAvatarUrl } from "@/lib/discord/cdn";
import { useGuildPermissions } from "@/hooks/use-permissions";
import { can } from "@/lib/discord/permissions";
import { toast } from "sonner";
import Image from "next/image";
import {
  Ban,
  Check,
  ClockPlus,
  Copy,
  Plus,
  ShieldAlert,
  TimerOff,
  UserRoundMinus,
  X,
} from "lucide-react";

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
      nowListeners.forEach((l) => l());
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
  const guild = useRealtimeStore((s) => s.guilds.get(guildId));
  const member = useRealtimeStore((s) =>
    (s.members.get(guildId) ?? []).find((m) => m.user?.id === userId),
  );
  const presence = useRealtimeStore((s) =>
    (s.presences.get(guildId) ?? []).find((p) => p.user.id === userId),
  );
  const upsertMember = useRealtimeStore((s) => s.upsertMember);
  const perms = useGuildPermissions(guildId);
  const [open, setOpen] = useState(false);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);

  const u = member?.user;
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
  const accent = colorRole ? "#" + colorRole.color.toString(16).padStart(6, "0") : undefined;

  const now = useSyncExternalStore(subscribeNow, getNowSnapshot, getNowServerSnapshot);
  const isTimedOut = member?.communication_disabled_until
    ? new Date(member.communication_disabled_until).getTime() > now
    : false;
  const timeoutEnd = isTimedOut && member?.communication_disabled_until
    ? new Date(member.communication_disabled_until)
    : null;

  const canKick = can(perms, "Kick Members") && !u?.bot;
  const canBan = can(perms, "Ban Members") && !u?.bot;
  const canTimeout = can(perms, "Moderate Members") && !u?.bot;
  const canRoles = can(perms, "Manage Roles");

  function timeoutMember(min: number | null) {
    const p = async () => {
      const iso = min == null ? null : new Date(Date.now() + min * 60000).toISOString();
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
      const res = await removeMemberRole(guildId, userId, roleId);
      if ("message" in (res ?? {}) && (res as { message?: string }).message)
        throw new Error((res as { message: string }).message);
      if (member) upsertMember(guildId, { ...member, roles: memberRoles.filter((r) => r !== roleId) });
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
      const res = await addMemberRole(guildId, userId, roleId);
      if ("message" in (res ?? {}) && (res as { message?: string }).message)
        throw new Error((res as { message: string }).message);
      if (member) upsertMember(guildId, { ...member, roles: [...memberRoles, roleId] });
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
        side="left"
        align="start"
        className="w-80 p-0 overflow-hidden border-2 max-w-[calc(100vw-2rem)]"
      >
        <TooltipProvider delayDuration={500}>
          <div
            className="h-14"
            style={{
              background: accent ? accent : "linear-gradient(135deg, #4f46e5, #06b6d4)",
            }}
          />
          <div className="px-4 pb-4 -mt-8 relative z-10">
            <Image
              src={av}
              alt={name}
              width={64}
              height={64}
              unoptimized
              className="rounded-full ring-4 ring-background relative"
            />
            <div className="mt-2">
              <div className="font-semibold text-base flex items-center gap-2 flex-wrap">
                <span className="truncate">{name}</span>
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
            {presence?.activities?.[0] && (
              <div className="mt-2 text-xs">
                <span className="text-muted-foreground">Playing </span>
                <span className="font-medium">{presence.activities[0].name}</span>
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
                  <DropdownMenu open={rolePickerOpen} onOpenChange={setRolePickerOpen}>
                    <DropdownMenuTrigger asChild>
                      <button className="size-5 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
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
                        <DropdownMenuItem disabled>No more roles</DropdownMenuItem>
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
                                  ? "#" + r.color.toString(16).padStart(6, "0")
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
                  <span className="text-[10px] text-muted-foreground">No roles</span>
                )}
                {assignedRoles.slice(0, 12).map((r) => {
                  const colorHex = r.color
                    ? "#" + r.color.toString(16).padStart(6, "0")
                    : undefined;
                  return (
                    <span
                      key={r.id}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border"
                      style={{
                        borderColor: colorHex,
                        color: colorHex,
                      }}
                    >
                      {r.name}
                      {canRoles && !r.managed && (
                        <button
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
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent>Copy user ID</TooltipContent>
              </Tooltip>

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
                  <TooltipContent>Bot lacks moderation perms in this guild</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </TooltipProvider>
      </PopoverContent>
    </Popover>
  );
}
