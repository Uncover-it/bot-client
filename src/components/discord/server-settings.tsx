"use client";

import { useEffect, useState } from "react";
import { useRealtimeStore } from "@/lib/store";
import {
  createChannel,
  createRole,
  deleteChannel,
  deleteRole,
  getAuditLog,
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
  ScrollText,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";
import { avatarUrl } from "@/lib/discord/cdn";
import type { Ban as BanType, Channel, Role } from "@/lib/discord/types";
import { useGuildPermissions } from "@/hooks/use-permissions";
import { ChannelSettingsDialog } from "@/components/discord/channel-settings-dialog";
import { RoleEditor } from "@/components/discord/role-editor";
import Spinner from "../ui/spinner";

interface Props {
  guildId: string;
}

type Tab = "overview" | "channels" | "roles" | "bans" | "audit" | "perms";

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
      <aside className="md:w-56 shrink-0 md:border-r border-b md:border-b-0 p-3 md:pt-12 pt-3 pl-14 md:pl-3 flex md:flex-col gap-1 overflow-x-auto">
        <Link
          href={`/dashboard`}
          className="hidden md:flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-2 py-1"
        >
          ← Back
        </Link>
        <SettingsTab
          id="overview"
          label="Overview"
          current={tab}
          onClick={setTab}
        />
        <SettingsTab
          id="channels"
          label="Channels"
          current={tab}
          onClick={setTab}
        />
        <SettingsTab id="roles" label="Roles" current={tab} onClick={setTab} />
        <SettingsTab id="bans" label="Bans" current={tab} onClick={setTab} />
        <SettingsTab
          id="audit"
          label="Audit log"
          current={tab}
          onClick={setTab}
        />
        <SettingsTab
          id="perms"
          label="Bot permissions"
          current={tab}
          onClick={setTab}
        />
      </aside>
      <div className="flex-1 overflow-y-auto p-4 md:p-8 min-w-0">
        {tab === "overview" && <Overview guildId={guildId} />}
        {tab === "channels" && <ChannelsPane guildId={guildId} />}
        {tab === "roles" && <RolesPane guildId={guildId} />}
        {tab === "bans" && <BansPane guildId={guildId} />}
        {tab === "audit" && <AuditPane guildId={guildId} />}
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
        current === id
          ? "bg-accent text-accent-foreground"
          : "hover:bg-muted text-muted-foreground"
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
    const p = (async () => {
      const res = await updateGuild(guildId, { name, description });
      if (!res?.id) throw new Error(res?.message ?? "Update failed");
      upsertGuild(res);
    })();
    toast.promise(p, {
      loading: "Saving",
      success: "Saved",
      error: (e) => `Error: ${e.message}`,
    });
    p.finally(() => setBusy(false));
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
          <div className="font-mono text-xs text-muted-foreground">
            {guild.id}
          </div>
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
          <ShieldCheck className="size-3" /> Bot lacks Manage Server permission.
          Read-only.
        </p>
      )}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Server name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canManage}
          />
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
  if (
    type === CHANNEL_TYPE.GUILD_VOICE ||
    type === CHANNEL_TYPE.GUILD_STAGE_VOICE
  )
    return <Mic className="size-4 text-muted-foreground" />;
  if (type === CHANNEL_TYPE.GUILD_ANNOUNCEMENT)
    return <Megaphone className="size-4 text-muted-foreground" />;
  if (type === CHANNEL_TYPE.GUILD_CATEGORY)
    return (
      <span className="text-xs uppercase font-bold tracking-[0.18em]">CAT</span>
    );
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
      const res: Channel = await createChannel(guildId, {
        name,
        type: Number(type),
      });
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

  const sorted = [...channels].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );

  return (
    <div className="max-w-3xl space-y-4 min-w-0">
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
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
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
        <p className="text-xs text-muted-foreground">
          Read-only — bot lacks Manage Channels.
        </p>
      )}
      <div className="border rounded-md divide-y">
        {sorted.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-2 p-2 group hover:bg-muted/30"
          >
            {channelIcon(c.type)}
            <Input
              defaultValue={c.name}
              onBlur={(e) => handleRename(c, e.currentTarget.value)}
              disabled={!canManage}
              className="border-none shadow-none bg-transparent h-8 focus-visible:ring-0 px-1"
            />
            <span className="text-xs text-muted-foreground font-mono">
              {c.id}
            </span>
            {canManage && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="md:opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                  onClick={() => setEditing(c)}
                >
                  <Settings className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="md:opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
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
    toast.promise(p(), {
      loading: "Creating role",
      success: "Created",
      error: (e) => `Error: ${e.message}`,
    });
  }

  async function handleDelete(role: Role) {
    if (!canManage) return;
    if (!confirm(`Delete role "${role.name}"?`)) return;
    const p = async () => {
      const res = await deleteRole(guildId, role.id);
      if (res?.message) throw new Error(res.message);
      setRoles(
        guildId,
        (guild?.roles ?? []).filter((r) => r.id !== role.id),
      );
    };
    toast.promise(p(), {
      loading: "Deleting",
      success: "Deleted",
      error: (e) => `Error: ${e.message}`,
    });
  }

  return (
    <div className="max-w-3xl space-y-4 min-w-0">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Roles ({roles.length})</h2>
        {canManage && (
          <Button size="sm" onClick={handleCreate}>
            <Plus className="size-4 mr-1" /> New role
          </Button>
        )}
      </div>
      {!canManage && (
        <p className="text-xs text-muted-foreground">
          Read-only — bot lacks Manage Roles.
        </p>
      )}
      <div className="border rounded-md divide-y min-w-0">
        {roles.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-2 p-2 sm:p-3 group hover:bg-muted/30 min-w-0"
          >
            <span
              className="size-3 rounded-full ring-1 ring-border shrink-0"
              style={{
                background: r.color
                  ? "#" + r.color.toString(16).padStart(6, "0")
                  : "var(--muted-foreground)",
              }}
            />
            <span className="font-medium truncate min-w-0">{r.name}</span>
            {r.hoist && (
              <span className="hidden sm:inline text-[10px] uppercase font-bold text-muted-foreground tracking-[0.18em] shrink-0">
                Hoisted
              </span>
            )}
            {r.managed && (
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-[0.18em] inline-flex items-center gap-1 shrink-0">
                <Crown className="size-3" />
                <span className="hidden sm:inline">Managed</span>
              </span>
            )}
            <span className="ml-auto hidden md:inline text-xs text-muted-foreground font-mono truncate max-w-[14ch] shrink-0">
              {r.id}
            </span>
            {canManage && (
              <div className="flex items-center gap-0.5 shrink-0 ml-auto md:ml-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 md:opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                  onClick={() => setEditing(r)}
                >
                  <Settings className="size-4" />
                </Button>
                {!r.managed && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 md:opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                    onClick={() => handleDelete(r)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
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
    <div className="max-w-3xl space-y-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">
          Bans {bans ? `(${bans.length})` : ""}
        </h2>
      </div>
      {!canBan && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md flex items-center gap-2">
          <ShieldCheck className="size-3" /> Bot lacks Ban Members permission.
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {error}
        </p>
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
            <div
              key={b.user.id}
              className="flex items-center gap-3 p-3 hover:bg-muted/30"
            >
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

interface AuditEntry {
  id: string;
  action_type: number;
  user_id?: string | null;
  target_id?: string | null;
  reason?: string | null;
  changes?: { key: string; old_value?: unknown; new_value?: unknown }[];
  options?: Record<string, unknown>;
}

interface AuditUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  bot?: boolean;
}

const AUDIT_LABEL: Record<number, string> = {
  1: "Updated server",
  10: "Created channel",
  11: "Updated channel",
  12: "Deleted channel",
  13: "Created channel override",
  14: "Updated channel override",
  15: "Deleted channel override",
  20: "Kicked member",
  21: "Pruned members",
  22: "Banned member",
  23: "Unbanned member",
  24: "Updated member",
  25: "Updated member roles",
  26: "Moved member",
  27: "Disconnected member",
  28: "Added bot",
  30: "Created role",
  31: "Updated role",
  32: "Deleted role",
  40: "Created invite",
  41: "Updated invite",
  42: "Deleted invite",
  50: "Created webhook",
  51: "Updated webhook",
  52: "Deleted webhook",
  60: "Created emoji",
  61: "Updated emoji",
  62: "Deleted emoji",
  72: "Deleted message",
  73: "Bulk deleted messages",
  74: "Pinned message",
  75: "Unpinned message",
  80: "Created integration",
  81: "Updated integration",
  82: "Deleted integration",
  83: "Created stage instance",
  84: "Updated stage instance",
  85: "Deleted stage instance",
  90: "Created sticker",
  91: "Updated sticker",
  92: "Deleted sticker",
  100: "Created scheduled event",
  101: "Updated scheduled event",
  102: "Deleted scheduled event",
  110: "Created thread",
  111: "Updated thread",
  112: "Deleted thread",
  121: "Banned member (auto-mod)",
  140: "Created auto-mod rule",
  141: "Updated auto-mod rule",
  142: "Deleted auto-mod rule",
  143: "Auto-mod blocked message",
  144: "Auto-mod flagged message",
  145: "Auto-mod timed out member",
  150: "Updated voice channel status",
  151: "Deleted voice channel status",
};

function snowflakeTimestamp(id: string): number {
  try {
    return Number(BigInt(id) >> 22n) + 1420070400000;
  } catch {
    return 0;
  }
}

function formatChangeValue(value: unknown): string {
  if (value == null) return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((v) => {
        if (v && typeof v === "object") {
          const o = v as { name?: string; id?: string };
          if (o.name && o.id) return `${o.name} (${o.id})`;
          if (o.name) return o.name;
          if (o.id) return o.id;
          try {
            return JSON.stringify(v);
          } catch {
            return "[object]";
          }
        }
        return String(v);
      })
      .join(", ");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function humanizeChangeKey(key: string): string {
  if (key === "$add") return "added roles";
  if (key === "$remove") return "removed roles";
  return key;
}

function AuditPane({ guildId }: { guildId: string }) {
  const perms = useGuildPermissions(guildId);
  const canView = can(perms, "View Audit Log");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<Map<string, AuditUser>>(new Map());
  const [busy, setBusy] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("all");

  async function load(before?: string) {
    if (!canView) return;
    setBusy(true);
    setError(null);
    try {
      const res = await getAuditLog(guildId, {
        limit: 50,
        before,
        actionType: actionFilter === "all" ? undefined : Number(actionFilter),
      });
      if ("error" in res) throw new Error(res.error);
      const newEntries: AuditEntry[] = res.audit_log_entries ?? [];
      const newUsers: AuditUser[] = res.users ?? [];
      setUsers((cur) => {
        const next = new Map(cur);
        newUsers.forEach((u) => next.set(u.id, u));
        return next;
      });
      setEntries((cur) => (before ? [...cur, ...newEntries] : newEntries));
      if (newEntries.length < 50) setExhausted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit log");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setEntries([]);
    setExhausted(false);
    if (canView) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, canView, actionFilter]);

  const oldestId = entries[entries.length - 1]?.id;

  return (
    <div className="max-w-3xl space-y-4 min-w-0">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ScrollText className="size-5" />
          <h2 className="text-xl font-semibold">Audit log</h2>
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All actions</SelectItem>
            {Object.entries(AUDIT_LABEL)
              .sort(([, a], [, b]) => a.localeCompare(b))
              .map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {!canView && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md flex items-center gap-2">
          <ShieldCheck className="size-3" /> Bot lacks View Audit Log
          permission.
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {error}
        </p>
      )}

      {canView && entries.length === 0 && !busy && !error && (
        <p className="text-sm text-muted-foreground">No audit log entries.</p>
      )}

      {entries.length > 0 && (
        <ol className="border rounded-md divide-y">
          {entries.map((e) => {
            const u = e.user_id ? users.get(e.user_id) : null;
            const ts = snowflakeTimestamp(e.id);
            const label =
              AUDIT_LABEL[e.action_type] ?? `Action #${e.action_type}`;
            return (
              <li
                key={e.id}
                className="p-3 flex gap-3 hover:bg-muted/30 min-w-0"
              >
                <div className="size-7 rounded-full bg-muted shrink-0 overflow-hidden grid place-items-center mt-0.5">
                  {u ? (
                    <Image
                      src={avatarUrl(u.id, u.avatar)}
                      alt={u.username}
                      width={28}
                      height={28}
                      unoptimized
                    />
                  ) : (
                    <ScrollText className="size-3 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-medium truncate">
                      {u ? (u.global_name ?? u.username) : "System"}
                    </span>
                    <span className="text-muted-foreground">
                      {label.toLowerCase()}
                    </span>
                    {e.target_id && (
                      <span className="text-[10px] font-mono text-muted-foreground/70">
                        target {e.target_id}
                      </span>
                    )}
                  </div>
                  {e.reason && (
                    <div className="text-xs text-muted-foreground italic mt-0.5 break-words">
                      Reason: {e.reason}
                    </div>
                  )}
                  {e.changes && e.changes.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {e.changes.slice(0, 6).map((c, i) => {
                        const isAddRemove =
                          c.key === "$add" || c.key === "$remove";
                        const oldVal =
                          c.old_value !== undefined
                            ? formatChangeValue(c.old_value)
                            : null;
                        const newVal =
                          c.new_value !== undefined
                            ? formatChangeValue(c.new_value)
                            : null;
                        return (
                          <li
                            key={i}
                            className="text-xs font-mono text-muted-foreground break-words"
                          >
                            <span className="text-foreground/80">
                              {humanizeChangeKey(c.key)}
                            </span>
                            :{" "}
                            {isAddRemove ? (
                              <span className="text-foreground">
                                {(newVal ?? oldVal ?? "").slice(0, 120)}
                              </span>
                            ) : (
                              <>
                                {oldVal != null && (
                                  <span className="line-through opacity-60">
                                    {oldVal.slice(0, 80)}
                                  </span>
                                )}{" "}
                                {newVal != null && (
                                  <span className="text-foreground">
                                    {newVal.slice(0, 80)}
                                  </span>
                                )}
                              </>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5 text-right">
                  {ts ? new Date(ts).toLocaleString() : ""}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {canView && entries.length > 0 && !exhausted && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => load(oldestId)}
          >
            {busy ? <Spinner className="size-3 mr-1" /> : null}
            Load older
          </Button>
        </div>
      )}
      {canView && busy && entries.length === 0 && (
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <Spinner className="size-3" /> Loading…
        </p>
      )}
    </div>
  );
}

function PermsPane({ guildId }: { guildId: string }) {
  const guild = useRealtimeStore((s) => s.guilds.get(guildId));
  const allowed = guild?.permissions ? listPermissions(guild.permissions) : [];
  return (
    <div className="max-w-3xl space-y-4 min-w-0">
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
            <div
              key={p}
              className="text-sm px-3 py-1.5 rounded-md bg-muted/50 flex items-center gap-2"
            >
              <span className="size-1.5 rounded-full bg-green-500" />
              {p}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No permissions detected.
        </p>
      )}
    </div>
  );
}
