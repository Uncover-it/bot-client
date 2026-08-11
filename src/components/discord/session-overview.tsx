"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowUpRight,
  Hash,
  MessagesSquare,
  ShieldAlert,
  Users,
} from "lucide-react";
import { DiscordAvatar } from "@/components/ui/discord-avatar";
import { UnreadBadge } from "@/components/discord/unread-badge";
import { getMissingPrivilegedIntents } from "@/components/discord/intent-warning";
import { useRealtimeStore } from "@/lib/store";
import { avatarUrl } from "@/lib/discord/cdn";
import { CHANNEL_TYPE } from "@/lib/discord/constants";
import { cn } from "@/lib/utils";

const GATEWAY_LABEL: Record<string, string> = {
  idle: "Idle",
  connecting: "Connecting",
  identifying: "Connecting",
  ready: "Live",
  resuming: "Resuming",
  reconnecting: "Reconnecting",
  disconnected: "Offline",
};

/** A label/value pair in the readout. The label is the quiet half. */
function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad";
}) {
  return (
    <div className="px-4 py-3 min-w-0">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-mono tabular-nums truncate",
          tone === "ok" && "text-emerald-500",
          tone === "warn" && "text-yellow-500",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function SessionOverview() {
  const user = useRealtimeStore((s) => s.user);
  const guildsMap = useRealtimeStore((s) => s.guilds);
  const dmsMap = useRealtimeStore((s) => s.dms);
  const unread = useRealtimeStore((s) => s.unread);
  const gatewayState = useRealtimeStore((s) => s.gatewayState);
  const ping = useRealtimeStore((s) => s.pingMs);
  const intents = useRealtimeStore((s) => s.activeIntents);
  const selfMembers = useRealtimeStore((s) => s.selfMembers);

  const guilds = useMemo(() => Array.from(guildsMap.values()), [guildsMap]);
  const missing = getMissingPrivilegedIntents(intents);

  const timedOutIn = useMemo(() => {
    const now = Date.now();
    return Array.from(selfMembers.entries())
      .filter(([, m]) => {
        const until = m.communication_disabled_until;
        return !!until && new Date(until).getTime() > now;
      })
      .map(([guildId]) => guildsMap.get(guildId))
      .filter((g): g is NonNullable<typeof g> => !!g);
  }, [selfMembers, guildsMap]);

  // Every channel with something waiting, most unread first, resolved back to
  // the guild it belongs to so the link can be built.
  const waiting = useMemo(() => {
    const rows: {
      id: string;
      name: string;
      href: string;
      context: string;
      dm: boolean;
      count: number;
    }[] = [];
    unread.forEach((count, channelId) => {
      const dm = dmsMap.get(channelId);
      if (dm) {
        const r = dm.recipients?.[0];
        rows.push({
          id: channelId,
          name: r ? (r.global_name ?? r.username) : "Direct message",
          href: `/dashboard/dms/${channelId}`,
          context: "Direct message",
          dm: true,
          count,
        });
        return;
      }
      for (const g of guilds) {
        const ch = g.channels?.find((c) => c.id === channelId);
        if (!ch || ch.type === CHANNEL_TYPE.GUILD_CATEGORY) continue;
        rows.push({
          id: channelId,
          name: ch.name ?? channelId,
          href: `/dashboard/servers/${g.id}/channels/${channelId}`,
          context: g.name,
          dm: false,
          count,
        });
        return;
      }
    });
    return rows.sort((a, b) => b.count - a.count).slice(0, 6);
  }, [unread, dmsMap, guilds]);

  const live = gatewayState === "ready";

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-10 md:py-16 space-y-8">
      <header className="flex items-center gap-4">
        <DiscordAvatar
          src={user ? avatarUrl(user.id, user.avatar, 128) : "/discord.svg"}
          alt={user?.username ?? "bot"}
          size={56}
        />
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Signed in as
          </div>
          <h1 className="text-2xl font-semibold truncate">
            {user?.username ?? "Loading"}
          </h1>
          <p className="text-xs font-mono text-muted-foreground truncate">
            {user?.id}
          </p>
        </div>
      </header>

      <section className="border rounded-xl divide-y sm:divide-y-0 sm:grid sm:grid-cols-4 sm:divide-x overflow-hidden">
        <Stat
          label="Gateway"
          value={GATEWAY_LABEL[gatewayState] ?? gatewayState}
          tone={live ? "ok" : gatewayState === "disconnected" ? "bad" : "warn"}
        />
        <Stat label="Latency" value={live && ping ? `${ping}ms` : "—"} />
        <Stat label="Servers" value={String(guilds.length)} />
        <Stat label="Conversations" value={String(dmsMap.size)} />
      </section>

      {timedOutIn.length > 0 && (
        <section className="border border-destructive/40 bg-destructive/10 rounded-xl px-4 py-3 text-sm text-destructive">
          <div className="font-medium">
            Timed out in {timedOutIn.length}{" "}
            {timedOutIn.length === 1 ? "server" : "servers"}
          </div>
          <p className="text-xs text-destructive/80 mt-0.5">
            {timedOutIn.map((g) => g.name).join(", ")}. The bot cannot send
            messages there until a moderator lifts it or it expires.
          </p>
        </section>
      )}

      {missing.length > 0 && (
        <section className="border border-yellow-500/30 bg-yellow-500/10 rounded-xl px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
          <div className="flex items-center gap-1.5 font-medium">
            <ShieldAlert className="size-4" />
            Running with reduced data
          </div>
          <p className="text-xs mt-0.5 opacity-90">
            {missing.map((m) => m.label).join(", ")}{" "}
            {missing.length === 1 ? "is" : "are"} disabled in the Developer
            Portal, so parts of this client stay empty.
          </p>
        </section>
      )}

      <section>
        <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Waiting for you
        </h2>
        {waiting.length === 0 ? (
          <p className="text-sm text-muted-foreground border rounded-xl px-4 py-6 text-center">
            Nothing unread. Pick a server from the sidebar to start reading.
          </p>
        ) : (
          <ul className="border rounded-xl divide-y overflow-hidden">
            {waiting.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group"
                >
                  {row.dm ? (
                    <MessagesSquare className="size-4 text-muted-foreground shrink-0" />
                  ) : (
                    <Hash className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-mono text-sm truncate">{row.name}</span>
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                    {row.context}
                  </span>
                  <UnreadBadge channelId={row.id} />
                  <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Servers
        </h2>
        {guilds.length === 0 ? (
          <p className="text-sm text-muted-foreground border rounded-xl px-4 py-6 text-center">
            No servers yet. Invite the bot somewhere and it appears here.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {guilds.slice(0, 8).map((g) => {
              const first = g.channels?.find(
                (c) =>
                  c.type === CHANNEL_TYPE.GUILD_TEXT ||
                  c.type === CHANNEL_TYPE.GUILD_ANNOUNCEMENT,
              );
              const body = (
                <>
                  <span className="size-8 rounded-lg bg-border grid place-items-center font-mono font-medium shrink-0">
                    {g.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {g.name}
                    </span>
                    {typeof g.member_count === "number" && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                        <Users className="size-3" />
                        {g.member_count}
                      </span>
                    )}
                  </span>
                </>
              );
              return (
                <li key={g.id}>
                  {first ? (
                    <Link
                      href={`/dashboard/servers/${g.id}/channels/${first.id}`}
                      className="flex items-center gap-3 border rounded-xl px-3 py-2.5 hover:bg-muted/40 transition-colors"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 border rounded-xl px-3 py-2.5 opacity-70">
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
