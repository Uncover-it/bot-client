"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRealtimeStore } from "@/lib/store";
import { getGateway } from "@/hooks/use-gateway";
import { Input } from "@/components/ui/input";
import { DiscordAvatar } from "@/components/ui/discord-avatar";
import { avatarUrl } from "@/lib/discord/cdn";
import { UserProfilePopover } from "@/components/discord/user-profile-popover";
import { IntentBanner } from "@/components/discord/intent-warning";
import { getGuildMembers } from "@/api/data/actions";
import { INTENTS } from "@/lib/discord/constants";
import type { GuildMember, Presence, Role } from "@/lib/discord/types";
import { cn } from "@/lib/utils";

interface Props {
  guildId: string;
}

interface Group {
  role: Role | null;
  members: { member: GuildMember; presence?: Presence }[];
}

const PAGE_SIZE = 60;
const PAGE_INC = 60;

export function MemberList({ guildId }: Props) {
  const guild = useRealtimeStore((s) => s.guilds.get(guildId));
  const membersRaw = useRealtimeStore((s) => s.members.get(guildId));
  const presencesRaw = useRealtimeStore((s) => s.presences.get(guildId));
  const setMembers = useRealtimeStore((s) => s.setMembers);
  const activeIntents = useRealtimeStore((s) => s.activeIntents);
  const members = useMemo(() => membersRaw ?? [], [membersRaw]);
  const presences = useMemo(() => presencesRaw ?? [], [presencesRaw]);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasPresences = (activeIntents & INTENTS.GUILD_PRESENCES) !== 0;
  const hasMembersIntent = (activeIntents & INTENTS.GUILD_MEMBERS) !== 0;

  useEffect(() => {
    let alive = true;
    if (members.length > 0) return;
    if (hasMembersIntent) {
      const gw = getGateway();
      gw?.requestGuildMembers(guildId, "", 0);
    } else {
      (async () => {
        try {
          const data: GuildMember[] = await getGuildMembers(guildId, 1000);
          if (alive && Array.isArray(data)) setMembers(guildId, data);
        } catch {}
      })();
    }
    return () => {
      alive = false;
    };
  }, [guildId, hasMembersIntent, setMembers, members.length]);

  const presenceMap = useMemo(() => {
    const m = new Map<string, Presence>();
    presences.forEach((p) => m.set(p.user.id, p));
    return m;
  }, [presences]);

  const groups = useMemo<Group[]>(() => {
    const roles = (guild?.roles ?? [])
      .filter((r) => r.hoist && r.id !== guildId)
      .sort((a, b) => b.position - a.position);

    const filtered = members.filter((m) => {
      if (!query) return true;
      const name = (m.nick ?? m.user?.global_name ?? m.user?.username ?? "").toLowerCase();
      return name.includes(query.toLowerCase());
    });

    const groupMap = new Map<string, Group>();
    roles.forEach((r) => groupMap.set(r.id, { role: r, members: [] }));
    const everyone: Group = { role: null, members: [] };
    const offline: Group = { role: { id: "offline", name: "Offline" } as Role, members: [] };

    filtered.forEach((m) => {
      const p = m.user?.id ? presenceMap.get(m.user.id) : undefined;
      const status = p?.status ?? "offline";
      const entry = { member: m, presence: p };

      if (hasPresences && status === "offline") {
        offline.members.push(entry);
        return;
      }

      const hoistRole = roles.find((r) => m.roles.includes(r.id));
      if (hoistRole) groupMap.get(hoistRole.id)!.members.push(entry);
      else everyone.members.push(entry);
    });

    const sortMembers = (g: Group) =>
      g.members.sort((a, b) => {
        const an = a.member.nick ?? a.member.user?.global_name ?? a.member.user?.username ?? "";
        const bn = b.member.nick ?? b.member.user?.global_name ?? b.member.user?.username ?? "";
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
    return result;
  }, [members, presenceMap, guild?.roles, guildId, query, hasPresences]);

  const total = members.length;
  const onlineCount = hasPresences
    ? members.filter((m) => {
        const s = m.user?.id ? presenceMap.get(m.user.id)?.status : undefined;
        return s && s !== "offline";
      }).length
    : total;

  const flatMembers = useMemo(() => {
    const out: { groupKey: string; data: typeof groups[number]["members"][number] | null; header?: typeof groups[number] }[] = [];
    groups.forEach((g) => {
      const key = g.role?.id ?? "everyone";
      out.push({ groupKey: key, data: null, header: g });
      g.members.forEach((m) => out.push({ groupKey: key, data: m }));
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
          className="h-8 text-xs"
        />
      </div>
      <IntentBanner reason="members" />
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto p-2">
        {!hasMembersIntent && members.length === 0 && (
          <p className="text-xs text-muted-foreground p-2">
            Loading via REST… if empty, bot may lack View Members permission.
          </p>
        )}
        {visibleSlice.map((row, idx) => {
          if (row.header) {
            const g = row.header;
            return (
              <div
                key={`h-${row.groupKey}`}
                className="text-[10px] uppercase tracking-[0.18em] font-semibold px-2 py-1 text-muted-foreground mt-2"
                style={
                  g.role && g.role.id !== "offline" && g.role.color
                    ? { color: "#" + g.role.color.toString(16).padStart(6, "0") }
                    : undefined
                }
              >
                {g.role?.name ?? "Members"} — {g.members.length}
              </div>
            );
          }
          if (!row.data) return null;
          const { member, presence } = row.data;
          const u = member.user;
          if (!u) return null;
          const name = member.nick ?? u.global_name ?? u.username;
          const status = presence?.status ?? "offline";
          const colorRole = (guild?.roles ?? [])
            .filter((r) => member.roles.includes(r.id) && r.color !== 0)
            .sort((a, b) => b.position - a.position)[0];
          return (
            <UserProfilePopover
              key={`${row.groupKey}-${u.id}-${idx}`}
              guildId={guildId}
              userId={u.id}
              trigger={
                <button
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1 rounded-md hover:bg-muted/60 transition-colors",
                    hasPresences && status === "offline" && "opacity-50",
                  )}
                >
                  <DiscordAvatar
                    src={avatarUrl(u.id, u.avatar)}
                    alt={name}
                    size={24}
                    status={hasPresences ? (status as "online" | "idle" | "dnd" | "offline") : undefined}
                  />
                  <span
                    className="text-sm truncate"
                    style={
                      colorRole
                        ? { color: "#" + colorRole.color.toString(16).padStart(6, "0") }
                        : undefined
                    }
                  >
                    {name}
                  </span>
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
