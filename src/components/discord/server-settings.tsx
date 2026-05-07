"use client";

import { useEffect, useState } from "react";
import { useRealtimeStore } from "@/lib/store";
import {
  createChannel,
  createRole,
  deleteChannel,
  deleteRole,
  getGuild,
  getGuildBans,
  getGuildChannels,
  getGuildRoles,
  unban,
  updateChannel,
  updateGuild,
} from "@/api/data/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { listPermissions, can } from "@/lib/discord/permissions";
import { CHANNEL_TYPE } from "@/lib/discord/constants";
import { guildIconUrl } from "@/lib/discord/cdn";
import {
  Hash,
  Megaphone,
  Mic,
  MessageSquareText,
  FileImage,
  Plus,
  Trash2,
  ShieldCheck,
  Settings,
  Crown,
  Ban,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";
import { avatarUrl } from "@/lib/discord/cdn";
import type { Ban as BanType, Channel, Role } from "@/lib/discord/types";
import { useGuildPermissions } from "@/hooks/use-permissions";
import { ChannelSettingsDialog } from "@/components/discord/channel-settings-dialog";
import { RoleEditor } from "@/components/discord/role-editor";

interface Props {
  guildId: string;
}

type Tab = "overview" | "channels" | "roles" | "bans" | "perms";

export function ServerSettings({ guildId }: Props) {
  const guild = useRealtimeStore((s) => s.guilds.get(guildId));
  const upsertGuild = useRealtimeStore((s) => s.upsertGuild);
  const setChannels = useRealtimeStore((s) => s.setChannels);
  const setRoles = useRealtimeStore((s) => s.setRoles);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [g, channels, roles] = await Promise.all([
          getGuild(guildId),
          getGuildChannels(guildId),
          getGuildRoles(guildId),
        ]);
        if (!alive) return;
        if (g?.id) upsertGuild(g);
        if (Array.isArray(channels)) setChannels(guildId, channels);
        if (Array.isArray(roles)) setRoles(guildId, roles);
      } catch {
        toast.error("Failed to load settings");
      }
    })();
    return () => {
      alive = false;
    };
  }, [guildId, upsertGuild, setChannels, setRoles]);

  if (!guild) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex h-full flex-col md:flex-row min-w-0">
      <aside className="md:w-56 shrink-0 md:border-r border-b md:border-b-0 p-3 md:pt-12 pt-4 pl-12 md:pl-3 flex md:flex-col gap-1 overflow-x-auto">
        <Link
          href={`/dashboard`}
          className="hidden md:flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-2 py-1"
        >
          ← Back
        </Link>
        <SettingsTab id="overview" label="Overview" current={tab} onClick={setTab} />
        <SettingsTab id="channels" label="Channels" current={tab} onClick={setTab} />
        <SettingsTab id="roles" label="Roles" current={tab} onClick={setTab} />
        <SettingsTab id="bans" label="Bans" current={tab} onClick={setTab} />
        <SettingsTab id="perms" label="Bot permissions" current={tab} onClick={setTab} />
      </aside>
      <div className="flex-1 overflow-y-auto p-4 md:p-8 min-w-0">
        {tab === "overview" && <Overview guildId={guildId} />}
        {tab === "channels" && <ChannelsPane guildId={guildId} />}
        {tab === "roles" && <RolesPane guildId={guildId} />}
        {tab === "bans" && <BansPane guildId={guildId} />}
        {tab === "perms" && <PermsPane guildId={guildId} />}
      </div>
    </div>
  );
}

function SettingsTab({
  id,
  label,
  current,
  onClick,
}: {
  id: Tab;
  label: string;
  current: string;
  onClick: (id: Tab) => void;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`whitespace-nowrap text-left text-sm px-3 py-2 rounded-md transition-colors ${
        current === id ? "bg-accent text-accent-foreground" : "hover:bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function Overview({ guildId }: { guildId: string }) {
  const guild = useRealtimeStore((s) => s.guilds.get(guildId))!;
  const upsertGuild = useRealtimeStore((s) => s.upsertGuild);
  const perms = useGuildPermissions(guildId);
  const canManage = can(perms, "Manage Server");
  const [name, setName] = useState(guild.name);
  const [description, setDescription] = useState(guild.description ?? "");
  const [busy, setBusy] = useState(false);
  const icon = guildIconUrl(guildId, guild.icon, 256);

  async function save() {
    if (!canManage) return;
    setBusy(true);
    const p = async () => {
      const res = await updateGuild(guildId, { name, description });
      if (!res?.id) throw new Error(res?.message ?? "Update failed");
      upsertGuild(res);
    };
    toast.promise(p(), { loading: "Saving", success: "Saved", error: (e) => `Error: ${e.message}` });
    p().finally(() => setBusy(false));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start gap-4">
        {icon ? (
          <Image
            src={icon}
            alt={guild.name}
            width={96}
            height={96}
            unoptimized
            className="rounded-2xl"
          />
        ) : (
          <div className="size-24 grid place-items-center rounded-2xl bg-muted text-3xl font-mono">
            {guild.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 text-sm space-y-1 pt-2">
          <div className="font-mono text-xs text-muted-foreground">{guild.id}</div>
          <div>
            <span className="text-muted-foreground">Members: </span>
            {guild.member_count ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Premium tier: </span>
            {guild.premium_tier ?? 0}
          </div>
          <div>
            <span className="text-muted-foreground">Features: </span>
            {guild.features?.length ?? 0}
          </div>
        </div>
      </div>

      {!canManage && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md flex items-center gap-2">
          <ShieldCheck className="size-3" /> Bot lacks Manage Server permission. Read-only.
        </p>
      )}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Server name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canManage}
            className="min-h-24"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={!canManage || busy}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function channelIcon(type: number) {
  if (type === CHANNEL_TYPE.GUILD_VOICE || type === CHANNEL_TYPE.GUILD_STAGE_VOICE)
    return <Mic className="size-4 text-muted-foreground" />;
  if (type === CHANNEL_TYPE.GUILD_ANNOUNCEMENT)
    return <Megaphone className="size-4 text-muted-foreground" />;
  if (type === CHANNEL_TYPE.GUILD_CATEGORY)
    return <span className="text-xs uppercase font-bold tracking-[0.18em]">CAT</span>;
  if (type === CHANNEL_TYPE.GUILD_FORUM)
    return <MessageSquareText className="size-4 text-muted-foreground" />;
  if (type === CHANNEL_TYPE.GUILD_MEDIA)
    return <FileImage className="size-4 text-muted-foreground" />;
  return <Hash className="size-4 text-muted-foreground" />;
}

function ChannelsPane({ guildId }: { guildId: string }) {
  const guild = useRealtimeStore((s) => s.guilds.get(guildId));
  const channels = guild?.channels ?? [];
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>(String(CHANNEL_TYPE.GUILD_TEXT));
  const [editing, setEditing] = useState<Channel | null>(null);
  const upsertChannel = useRealtimeStore((s) => s.upsertChannel);
  const removeChannel = useRealtimeStore((s) => s.removeChannel);
  const perms = useGuildPermissions(guildId);
  const canManage = can(perms, "Manage Channels");

  function handleCreate() {
    if (!canManage) return;
    const p = async () => {
      const res: Channel = await createChannel(guildId, { name, type: Number(type) });
      if (!res.id) throw new Error("Create failed");
      upsertChannel(res);
      setOpen(false);
      setName("");
    };
    toast.promise(p(), {
      loading: "Creating",
      success: "Channel created",
      error: (e) => `Error: ${e.message}`,
    });
  }

  function handleDelete(id: string) {
    if (!canManage) return;
    if (!confirm("Delete this channel?")) return;
    const p = async () => {
      const res = await deleteChannel(id);
      if (res?.message) throw new Error(res.message);
      removeChannel(id, guildId);
    };
    toast.promise(p(), {
      loading: "Deleting",
      success: "Deleted",
      error: (e) => `Error: ${e.message}`,
    });
  }

  function handleRename(c: Channel, next: string) {
    if (!canManage || !next || next === c.name) return;
    const p = async () => {
      const res: Channel = await updateChannel(c.id, { name: next });
      if (!res.id) throw new Error("Update failed");
      upsertChannel(res);
    };
    toast.promise(p(), {
      loading: "Renaming",
      success: "Renamed",
      error: (e) => `Error: ${e.message}`,
    });
  }

  const sorted = [...channels].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Channels ({channels.length})</h2>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4 mr-1" /> New channel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create channel</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Text</SelectItem>
                      <SelectItem value="2">Voice</SelectItem>
                      <SelectItem value="13">Stage</SelectItem>
                      <SelectItem value="5">Announcement</SelectItem>
                      <SelectItem value="4">Category</SelectItem>
                      <SelectItem value="15">Forum</SelectItem>
                      <SelectItem value="16">Media</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={!name}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {!canManage && (
        <p className="text-xs text-muted-foreground">Read-only — bot lacks Manage Channels.</p>
      )}
      <div className="border rounded-md divide-y">
        {sorted.map((c) => (
          <div key={c.id} className="flex items-center gap-2 p-2 group hover:bg-muted/30">
            {channelIcon(c.type)}
            <Input
              defaultValue={c.name}
              onBlur={(e) => handleRename(c, e.currentTarget.value)}
              disabled={!canManage}
              className="border-none shadow-none bg-transparent h-8 focus-visible:ring-0 px-1"
            />
            <span className="text-xs text-muted-foreground font-mono">{c.id}</span>
            {canManage && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => setEditing(c)}
                >
                  <Settings className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => handleDelete(c.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
      {editing && (
        <ChannelSettingsDialog
          guildId={guildId}
          channel={editing}
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
        />
      )}
    </div>
  );
}

function RolesPane({ guildId }: { guildId: string }) {
  const guild = useRealtimeStore((s) => s.guilds.get(guildId));
  const setRoles = useRealtimeStore((s) => s.setRoles);
  const roles = (guild?.roles ?? [])
    .filter((r) => r.id !== guildId)
    .sort((a, b) => b.position - a.position);
  const [editing, setEditing] = useState<Role | null>(null);
  const perms = useGuildPermissions(guildId);
  const canManage = can(perms, "Manage Roles");

  async function handleCreate() {
    if (!canManage) return;
    const p = async () => {
      const res = await createRole(guildId, { name: "new role" });
      if (!res?.id) throw new Error(res?.message ?? "Create failed");
      setRoles(guildId, [...(guild?.roles ?? []), res]);
      setEditing(res);
    };
    toast.promise(p(), { loading: "Creating role", success: "Created", error: (e) => `Error: ${e.message}` });
  }

  async function handleDelete(role: Role) {
    if (!canManage) return;
    if (!confirm(`Delete role "${role.name}"?`)) return;
    const p = async () => {
      const res = await deleteRole(guildId, role.id);
      if (res?.message) throw new Error(res.message);
      setRoles(guildId, (guild?.roles ?? []).filter((r) => r.id !== role.id));
    };
    toast.promise(p(), { loading: "Deleting", success: "Deleted", error: (e) => `Error: ${e.message}` });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Roles ({roles.length})</h2>
        {canManage && (
          <Button size="sm" onClick={handleCreate}>
            <Plus className="size-4 mr-1" /> New role
          </Button>
        )}
      </div>
      {!canManage && (
        <p className="text-xs text-muted-foreground">Read-only — bot lacks Manage Roles.</p>
      )}
      <div className="border rounded-md divide-y">
        {roles.map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-3 group hover:bg-muted/30">
            <span
              className="size-3 rounded-full ring-1 ring-border"
              style={{ background: r.color ? "#" + r.color.toString(16).padStart(6, "0") : "#888" }}
            />
            <span className="font-medium">{r.name}</span>
            {r.hoist && (
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-[0.18em]">
                Hoisted
              </span>
            )}
            {r.managed && (
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-[0.18em] inline-flex items-center gap-1">
                <Crown className="size-3" /> Managed
              </span>
            )}
            <span className="ml-auto text-xs text-muted-foreground font-mono">{r.id}</span>
            {canManage && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => setEditing(r)}
                >
                  <Settings className="size-4" />
                </Button>
                {!r.managed && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => handleDelete(r)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {editing && (
        <RoleEditor
          guildId={guildId}
          role={editing}
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
        />
      )}
    </div>
  );
}

function BansPane({ guildId }: { guildId: string }) {
  const perms = useGuildPermissions(guildId);
  const canBan = can(perms, "Ban Members");
  const [bans, setBans] = useState<BanType[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canBan) {
      setBans([]);
      return;
    }
    let alive = true;
    setBusy(true);
    (async () => {
      try {
        const res = await getGuildBans(guildId, 1000);
        if (!alive) return;
        if (Array.isArray(res)) {
          setBans(res);
          setError(null);
        } else {
          setError(res?.message ?? "Failed to load bans");
          setBans([]);
        }
      } catch {
        setError("Failed to load bans");
        setBans([]);
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [guildId, canBan]);

  function handleUnban(b: BanType) {
    if (!canBan) return;
    if (!confirm(`Unban ${b.user.username}?`)) return;
    const p = async () => {
      const res = await unban(guildId, b.user.id);
      if ("message" in (res ?? {}) && (res as { message?: string }).message)
        throw new Error((res as { message: string }).message);
      setBans((cur) => (cur ?? []).filter((x) => x.user.id !== b.user.id));
    };
    toast.promise(p(), {
      loading: "Unbanning",
      success: "Unbanned",
      error: (e) => `Error: ${e.message}`,
    });
  }

  const filtered = (bans ?? []).filter((b) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      b.user.username.toLowerCase().includes(q) ||
      (b.user.global_name ?? "").toLowerCase().includes(q) ||
      b.user.id.includes(q)
    );
  });

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Bans {bans ? `(${bans.length})` : ""}</h2>
      </div>
      {!canBan && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md flex items-center gap-2">
          <ShieldCheck className="size-3" /> Bot lacks Ban Members permission.
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
      )}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search banned users"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>
      {busy ? (
        <p className="text-sm text-muted-foreground">Loading bans…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bans</p>
      ) : (
        <div className="border rounded-md divide-y">
          {filtered.map((b) => (
            <div key={b.user.id} className="flex items-center gap-3 p-3 hover:bg-muted/30">
              <Image
                src={avatarUrl(b.user.id, b.user.avatar)}
                alt={b.user.username}
                width={32}
                height={32}
                unoptimized
                className="rounded-full shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {b.user.global_name ?? b.user.username}
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate">
                  @{b.user.username} · {b.user.id}
                </div>
                {b.reason && (
                  <div className="text-xs text-muted-foreground italic mt-0.5 truncate">
                    Reason: {b.reason}
                  </div>
                )}
              </div>
              {canBan && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-emerald-500 border-emerald-500/40 shrink-0"
                  onClick={() => handleUnban(b)}
                >
                  <RotateCcw className="size-3 mr-1" /> Unban
                </Button>
              )}
              {!canBan && <Ban className="size-4 text-muted-foreground" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PermsPane({ guildId }: { guildId: string }) {
  const guild = useRealtimeStore((s) => s.guilds.get(guildId));
  const allowed = guild?.permissions ? listPermissions(guild.permissions) : [];
  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5" />
        <h2 className="text-xl font-semibold">Bot permissions</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Effective permissions evaluated for this bot in this guild.
      </p>
      {allowed.length ? (
        <div className="grid sm:grid-cols-2 gap-2">
          {allowed.map((p) => (
            <div key={p} className="text-sm px-3 py-1.5 rounded-md bg-muted/50 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-green-500" />
              {p}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No permissions detected.</p>
      )}
    </div>
  );
}
