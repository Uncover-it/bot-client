"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateRole } from "@/api/data/actions";
import { useRealtimeStore } from "@/lib/store";
import { useGuildPermissions } from "@/hooks/use-permissions";
import { can } from "@/lib/discord/permissions";
import { PERMISSIONS } from "@/lib/discord/constants";
import { toast } from "sonner";
import type { Role } from "@/lib/discord/types";
import { ShieldCheck } from "lucide-react";

interface Props {
  guildId: string;
  role: Role;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function RoleEditor({ guildId, role, open, onOpenChange }: Props) {
  const [name, setName] = useState(role.name);
  const [color, setColor] = useState(
    role.color ? "#" + role.color.toString(16).padStart(6, "0") : "#888888",
  );
  const [hoist, setHoist] = useState(role.hoist);
  const [mentionable, setMentionable] = useState(role.mentionable);
  const [perms, setPerms] = useState<bigint>(BigInt(role.permissions));
  const [busy, setBusy] = useState(false);

  const upsertRoles = useRealtimeStore((s) => s.setRoles);
  const guild = useRealtimeStore((s) => s.guilds.get(guildId));
  const botPerms = useGuildPermissions(guildId);
  const canManage = can(botPerms, "Manage Roles");

  useEffect(() => {
    setName(role.name);
    setColor(role.color ? "#" + role.color.toString(16).padStart(6, "0") : "#888888");
    setHoist(role.hoist);
    setMentionable(role.mentionable);
    setPerms(BigInt(role.permissions));
  }, [role]);

  function togglePerm(perm: keyof typeof PERMISSIONS) {
    setPerms((p) => p ^ PERMISSIONS[perm]);
  }

  async function save() {
    if (!canManage) return;
    setBusy(true);
    const colorInt = parseInt(color.replace("#", ""), 16);
    const p = (async () => {
      const res = await updateRole(guildId, role.id, {
        name,
        color: colorInt,
        hoist,
        mentionable,
        permissions: perms.toString(),
      });
      if (!res?.id) throw new Error(res?.message ?? "Update failed");
      const next = (guild?.roles ?? []).filter((r) => r.id !== res.id).concat(res);
      upsertRoles(guildId, next);
      onOpenChange(false);
    })();
    toast.promise(p, { loading: "Saving role", success: "Role updated", error: (e) => `Error: ${e.message}` });
    p.finally(() => setBusy(false));
  }

  const groups = {
    General: [
      "View Channel",
      "Manage Channels",
      "Manage Roles",
      "Manage Server",
      "View Audit Log",
      "Manage Webhooks",
      "Manage Guild Expressions",
      "Create Guild Expressions",
      "Manage Events",
      "View Guild Insights",
      "Administrator",
    ],
    Membership: [
      "Create Instant Invite",
      "Change Nickname",
      "Manage Nicknames",
      "Kick Members",
      "Ban Members",
      "Moderate Members",
    ],
    Text: [
      "Send Messages",
      "Send Messages in Threads",
      "Create Public Threads",
      "Create Private Threads",
      "Embed Links",
      "Attach Files",
      "Add Reactions",
      "Use External Emojis",
      "Use External Stickers",
      "Mention Everyone",
      "Manage Messages",
      "Manage Threads",
      "Read Message History",
      "Send TTS Messages",
      "Send Voice Messages",
      "Send Polls",
      "Pin Messages",
      "Use Application Commands",
    ],
    Voice: [
      "Connect",
      "Speak",
      "Stream",
      "Use VAD",
      "Priority Speaker",
      "Mute Members",
      "Deafen Members",
      "Move Members",
      "Request to Speak",
      "Use Soundboard",
    ],
  } as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="size-3 rounded-full"
              style={{ background: color }}
            />
            Edit role
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {role.name} · {role.id}
          </DialogDescription>
        </DialogHeader>
        {!canManage && (
          <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md flex items-center gap-2">
            <ShieldCheck className="size-3" /> Bot lacks Manage Roles permission. Read-only.
          </p>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage || role.managed} />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <Input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              disabled={!canManage || role.managed}
              className="h-10 p-1"
            />
          </div>
          <div className="col-span-3 flex gap-2">
            <Button
              variant={hoist ? "default" : "outline"}
              size="sm"
              onClick={() => setHoist((v) => !v)}
              disabled={!canManage || role.managed}
            >
              Hoist {hoist ? "on" : "off"}
            </Button>
            <Button
              variant={mentionable ? "default" : "outline"}
              size="sm"
              onClick={() => setMentionable((v) => !v)}
              disabled={!canManage || role.managed}
            >
              Mentionable {mentionable ? "on" : "off"}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(groups).map(([cat, list]) => (
            <div key={cat}>
              <div className="text-[10px] uppercase font-semibold tracking-[0.2em] text-muted-foreground mb-1">
                {cat}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {list.map((p) => {
                  const bit = PERMISSIONS[p as keyof typeof PERMISSIONS];
                  if (bit === undefined) return null;
                  const enabled = (perms & bit) !== 0n;
                  return (
                    <button
                      key={p}
                      onClick={() => togglePerm(p as keyof typeof PERMISSIONS)}
                      disabled={!canManage || role.managed}
                      className={`flex items-center justify-between text-xs px-2 py-1.5 rounded border transition-colors ${
                        enabled
                          ? "border-foreground/30 bg-foreground/5"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      } ${!canManage ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <span className="truncate text-left">{p}</span>
                      <span className={`size-3 rounded-sm ${enabled ? "bg-green-500" : "bg-muted"}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!canManage || busy || role.managed}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
