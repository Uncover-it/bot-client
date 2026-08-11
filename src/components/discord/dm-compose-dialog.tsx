"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Hash, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import Spinner from "@/components/ui/spinner";
import { DiscordAvatar } from "@/components/ui/discord-avatar";
import { getUser, searchGuildMembers } from "@/api/data/actions";
import { useRealtimeStore } from "@/lib/store";
import { useOpenDm } from "@/hooks/use-open-dm";
import { avatarUrl } from "@/lib/discord/cdn";
import type { GuildMember, User } from "@/lib/discord/types";

const ID_PATTERN = /^\d{15,25}$/;
/** Remote search costs one request per server, so cap the fan-out. */
const MAX_SEARCHED_GUILDS = 5;
const MAX_RESULTS = 12;

interface Candidate {
  user: User;
  /** Where this person was found, shown so duplicates make sense. */
  via: string;
}

export function DmComposeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [byId, setById] = useState<User | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const openDmWith = useOpenDm();

  const guildsMap = useRealtimeStore((s) => s.guilds);
  const membersMap = useRealtimeStore((s) => s.members);
  const selfId = useRealtimeStore((s) => s.user?.id);

  const needle = query.trim().toLowerCase();
  const isId = ID_PATTERN.test(query.trim());

  // Whatever is already in memory answers instantly; the remote search below
  // fills in everyone the client has never loaded.
  const local = useMemo(() => {
    if (!needle || isId) return [];
    const out: Candidate[] = [];
    const seen = new Set<string>();
    membersMap.forEach((members, guildId) => {
      const guildName = guildsMap.get(guildId)?.name ?? "a server";
      for (const m of members) {
        const u = m.user;
        if (!u || u.bot || u.id === selfId || seen.has(u.id)) continue;
        const name = (m.nick ?? u.global_name ?? u.username).toLowerCase();
        if (
          !name.includes(needle) &&
          !u.username.toLowerCase().includes(needle)
        )
          continue;
        seen.add(u.id);
        out.push({ user: u, via: guildName });
        if (out.length >= MAX_RESULTS) return;
      }
    });
    return out;
  }, [needle, isId, membersMap, guildsMap, selfId]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setRemote([]);
      setById(null);
      return;
    }
  }, [open]);

  // Pasted an ID: resolve it so the user sees who they are about to message
  // before a channel is created.
  useEffect(() => {
    if (!open || !isId) {
      setById(null);
      return;
    }
    let alive = true;
    const handle = window.setTimeout(async () => {
      try {
        const u: User | null = await getUser(query.trim());
        if (alive && u?.id) setById(u);
      } catch {}
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(handle);
    };
  }, [open, isId, query]);

  useEffect(() => {
    if (!open || !needle || isId || needle.length < 2) {
      setRemote([]);
      return;
    }
    let alive = true;
    setSearching(true);
    const handle = window.setTimeout(async () => {
      const guilds = Array.from(guildsMap.values()).slice(
        0,
        MAX_SEARCHED_GUILDS,
      );
      try {
        const pages = await Promise.all(
          guilds.map(async (g) => {
            const r: GuildMember[] = await searchGuildMembers(g.id, needle, 8);
            return { guild: g, members: Array.isArray(r) ? r : [] };
          }),
        );
        if (!alive) return;
        const seen = new Set<string>();
        const out: Candidate[] = [];
        for (const { guild, members } of pages) {
          for (const m of members) {
            const u = m.user;
            if (!u || u.bot || u.id === selfId || seen.has(u.id)) continue;
            seen.add(u.id);
            out.push({ user: u, via: guild.name });
          }
        }
        setRemote(out.slice(0, MAX_RESULTS));
      } catch {
        if (alive) setRemote([]);
      } finally {
        if (alive) setSearching(false);
      }
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(handle);
      setSearching(false);
    };
  }, [open, needle, isId, guildsMap, selfId]);

  const results = useMemo(() => {
    const seen = new Set(local.map((c) => c.user.id));
    return [...local, ...remote.filter((c) => !seen.has(c.user.id))].slice(
      0,
      MAX_RESULTS,
    );
  }, [local, remote]);

  async function pick(user: User) {
    if (busyId) return;
    setBusyId(user.id);
    const channel = await openDmWith(user);
    setBusyId(null);
    if (channel) {
      onOpenChange(false);
      toast.success(`Opened conversation with ${user.username}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3">
          <DialogTitle>Open a conversation</DialogTitle>
          <DialogDescription>
            Discord does not let bots list their DMs, so this list starts empty.
            Open someone here and their whole existing conversation comes back.
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              autoFocus
              placeholder="Search by name, or paste a user ID"
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto border-t">
          {!needle && (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              Search anyone the bot shares a server with.
            </p>
          )}

          {isId && (
            <PersonRow
              user={
                byId ?? {
                  id: query.trim(),
                  username: query.trim(),
                  discriminator: "0",
                }
              }
              via={byId ? "Found by ID" : "Open by ID"}
              busy={busyId === query.trim()}
              unresolved={!byId}
              onSelect={pick}
            />
          )}

          {!isId &&
            results.map((c) => (
              <PersonRow
                key={c.user.id}
                user={c.user}
                via={c.via}
                busy={busyId === c.user.id}
                onSelect={pick}
              />
            ))}

          {!isId && needle && searching && results.length === 0 && (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Spinner size={14} /> Searching servers
            </div>
          )}

          {!isId && needle && !searching && results.length === 0 && (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center space-y-1">
              <p>Nobody matches “{query}”.</p>
              <p className="text-xs">
                Members only turn up if the bot shares a server with them.
                Otherwise paste their user ID.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PersonRow({
  user,
  via,
  busy,
  unresolved,
  onSelect,
}: {
  user: User;
  via: string;
  busy: boolean;
  unresolved?: boolean;
  onSelect: (u: User) => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onSelect(user)}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors disabled:opacity-60"
    >
      {unresolved ? (
        <span className="size-8 rounded-full bg-muted grid place-items-center shrink-0">
          <Hash className="size-4 text-muted-foreground" />
        </span>
      ) : (
        <DiscordAvatar
          src={avatarUrl(user.id, user.avatar)}
          alt={user.username}
          size={32}
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm truncate">
          {user.global_name ?? user.username}
        </span>
        <span className="block text-[11px] font-mono text-muted-foreground truncate">
          {unresolved ? user.id : `@${user.username}`}
        </span>
      </span>
      {busy ? (
        <Spinner size={14} />
      ) : (
        <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground shrink-0 max-w-24 truncate">
          {via}
        </span>
      )}
    </button>
  );
}
