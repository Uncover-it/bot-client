"use client";

import { useMemo, useRef, useState } from "react";
import { TimerOff } from "lucide-react";
import { useRealtimeStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { DiscordAvatar } from "@/components/ui/discord-avatar";
import { avatarUrl } from "@/lib/discord/cdn";
import { UserProfilePopover } from "@/components/discord/user-profile-popover";
import { IntentBanner } from "@/components/discord/intent-warning";
import { INTENTS } from "@/lib/discord/constants";
import type { GuildMember, Presence, Role } from "@/lib/discord/types";
import { readableRoleColor } from "@/lib/discord/role-color";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { cn } from "@/lib/utils";

interface Props {
  guildId: string;
}

interface Entry {
  member: GuildMember;
  presence?: Presence;
  /** Highest coloured role, resolved once during grouping. */
  color?: string;
}

interface Group {
  role: Role | null;
  members: Entry[];
}

const PAGE_SIZE = 60;
const PAGE_INC = 60;

export function MemberList({ guildId }: Props) {
  const theme = useResolvedTheme();
  const guild = useRealtimeStore((s) => s.guilds.get(guildId));
  const membersRaw = useRealtimeStore((s) => s.members.get(guildId));
  const presencesRaw = useRealtimeStore((s) => s.presences.get(guildId));
  const activeIntents = useRealtimeStore((s) => s.activeIntents);
  const members = useMemo(() => membersRaw ?? [], [membersRaw]);
  const presences = useMemo(() => presencesRaw ?? [], [presencesRaw]);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasPresences = (activeIntents & INTENTS.GUILD_PRESENCES) !== 0;
  const hasMembersIntent = (activeIntents & INTENTS.GUILD_MEMBERS) !== 0;

  // Members are loaded once by ChannelView, which is always this component's
  // parent. Fetching here too would double every request.

  const presenceMap = useMemo(() => {
    const m = new Map<string, Presence>();
    presences.forEach((p) => {
      m.set(p.user.id, p);
    });
    return m;
  }, [presences]);

  const { groups, onlineCount } = useMemo(() => {
    const allRoles = guild?.roles ?? [];
    const roleById = new Map<string, Role>();
    allRoles.forEach((r) => {
      roleById.set(r.id, r);
    });
    const hoistRoles = allRoles
      .filter((r) => r.hoist && r.id !== guildId)
      .sort((a, b) => b.position - a.position);

    const needle = query.trim().toLowerCase();
    const groupMap = new Map<string, Group>();
    hoistRoles.forEach((r) => {
      groupMap.set(r.id, { role: r, members: [] });
    });
    const everyone: Group = { role: null, members: [] };
    const offline: Group = {
      role: { id: "offline", name: "Offline" } as Role,
      members: [],
    };

    let online = 0;

    members.forEach((m) => {
      const p = m.user?.id ? presenceMap.get(m.user.id) : undefined;
      const status = p?.status ?? "offline";
      if (status !== "offline") online++;

      if (needle) {
        const name = (
          m.nick ??
          m.user?.global_name ??
          m.user?.username ??
          ""
        ).toLowerCase();
        if (!name.includes(needle)) return;
      }

      // Walk the member's own roles (usually a handful) rather than scanning
      // every guild role for every member.
      let hoist: Role | undefined;
      let colorRole: Role | undefined;
      for (const id of m.roles ?? []) {
        const r = roleById.get(id);
        if (!r) continue;
        if (
          r.hoist &&
          r.id !== guildId &&
          (!hoist || r.position > hoist.position)
        ) {
          hoist = r;
        }
        if (r.color !== 0 && (!colorRole || r.position > colorRole.position)) {
          colorRole = r;
        }
      }

      const entry: Entry = {
        member: m,
        presence: p,
        color: colorRole
          ? `#${colorRole.color.toString(16).padStart(6, "0")}`
          : undefined,
      };

      if (hasPresences && status === "offline") offline.members.push(entry);
      else if (hoist) groupMap.get(hoist.id)?.members.push(entry);
      else everyone.members.push(entry);
    });

    const sortMembers = (g: Group) =>
      g.members.sort((a, b) => {
        const an =
          a.member.nick ??
          a.member.user?.global_name ??
          a.member.user?.username ??
          "";
        const bn =
          b.member.nick ??
          b.member.user?.global_name ??
          b.member.user?.username ??
          "";
        return an.localeCompare(bn);
      });

    const result: Group[] = [];
    groupMap.forEach((g) => {
      if (g.members.length) {
        sortMembers(g);
        result.push(g);
      }
    });
    if (everyone.members.length) {
      sortMembers(everyone);
      result.push(everyone);
    }
    if (hasPresences && offline.members.length) {
      sortMembers(offline);
      result.push(offline);
    }
    return {
      groups: result,
      onlineCount: hasPresences ? online : members.length,
    };
  }, [members, presenceMap, guild?.roles, guildId, query, hasPresences]);

  const total = members.length;

  const flatMembers = useMemo(() => {
    const out: { groupKey: string; data: Entry | null; header?: Group }[] = [];
    groups.forEach((g) => {
      const key = g.role?.id ?? "everyone";
      out.push({ groupKey: key, data: null, header: g });
      g.members.forEach((m) => {
        out.push({ groupKey: key, data: m });
      });
    });
    return out;
  }, [groups]);

  const visibleSlice = flatMembers.slice(0, limit);
  const hasMore = flatMembers.length > limit;

  function onScroll() {
    const el = scrollRef.current;
    if (!el || !hasMore) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 200) {
      setLimit((l) => l + PAGE_INC);
    }
  }

  return (
    <div className="w-full md:w-60 shrink-0 md:border-l bg-sidebar h-full flex flex-col">
      <div className="px-3 pt-3 pb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
        {hasPresences ? `${onlineCount}/${total} online` : `${total} members`}
      </div>
      <div className="px-2 pb-2 border-b">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="h-9 md:h-8 text-base md:text-xs"
        />
      </div>
      <IntentBanner reason="members" />
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto p-2"
      >
        {!hasMembersIntent && members.length === 0 && (
          <p className="text-xs text-muted-foreground p-2">
            Loading via REST… if empty, bot may lack View Members permission.
          </p>
        )}
        {visibleSlice.map((row) => {
          if (row.header) {
            const g = row.header;
            return (
              <div
                key={`h-${row.groupKey}`}
                className="text-[10px] uppercase tracking-[0.18em] font-semibold px-2 py-1 text-muted-foreground mt-2"
                style={
                  g.role && g.role.id !== "offline" && g.role.color
                    ? {
                        color: readableRoleColor(
                          `#${g.role.color.toString(16).padStart(6, "0")}`,
                          theme,
                        ),
                      }
                    : undefined
                }
              >
                {g.role?.name ?? "Members"} — {g.members.length}
              </div>
            );
          }
          if (!row.data) return null;
          const { member, presence, color } = row.data;
          const u = member.user;
          if (!u) return null;
          const name = member.nick ?? u.global_name ?? u.username;
          const status = presence?.status ?? "offline";
          const timedOut = member.communication_disabled_until
            ? new Date(member.communication_disabled_until).getTime() >
              Date.now()
            : false;
          return (
            <UserProfilePopover
              key={`${row.groupKey}-${u.id}`}
              guildId={guildId}
              userId={u.id}
              trigger={
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1 rounded-md hover:bg-muted/60 transition-colors",
                    hasPresences && status === "offline" && "opacity-50",
                  )}
                >
                  <DiscordAvatar
                    src={avatarUrl(u.id, u.avatar)}
                    alt={name}
                    size={24}
                    status={
                      hasPresences
                        ? (status as "online" | "idle" | "dnd" | "offline")
                        : undefined
                    }
                  />
                  <span
                    className="text-sm truncate"
                    style={
                      color
                        ? { color: readableRoleColor(color, theme) }
                        : undefined
                    }
                  >
                    {name}
                  </span>
                  {timedOut && (
                    <TimerOff
                      className="size-3 text-destructive shrink-0"
                      aria-label="Timed out"
                    />
                  )}
                  {u.bot && (
                    <span className="px-1 rounded bg-blue-500 text-white text-[8px] font-bold">
                      BOT
                    </span>
                  )}
                </button>
              }
            />
          );
        })}
        {hasMore && (
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE_INC)}
            className="w-full text-xs text-muted-foreground hover:text-foreground py-2 mt-2"
          >
            Show more ({flatMembers.length - limit} hidden)
          </button>
        )}
      </div>
    </div>
  );
}
