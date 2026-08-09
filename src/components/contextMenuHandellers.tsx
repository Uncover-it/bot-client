"use client";

import { useState } from "react";
import { ContextMenuItem } from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Copy,
  UserRoundPlus,
  UserRound,
  MessageCircle,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { getInviteCode } from "@/api/data/actions";

export function CopyID({ id }: { id: number | string }) {
  const copy = () => {
    navigator.clipboard.writeText(id.toString());
    toast.success("Copied to clipboard");
  };
  return (
    <ContextMenuItem onSelect={() => copy()}>
      <Copy />
      Copy ID
    </ContextMenuItem>
  );
}

export function CopyUsername({ username }: { username: string }) {
  const copy = () => {
    navigator.clipboard.writeText(username);
    toast.success("Copied to clipboard");
  };
  return (
    <ContextMenuItem onSelect={() => copy()}>
      <UserRound />
      Copy Username
    </ContextMenuItem>
  );
}

export function CopyMessage({ message }: { message: string }) {
  const copy = () => {
    navigator.clipboard.writeText(message);
    toast.success("Copied to clipboard");
  };
  return (
    <ContextMenuItem onSelect={() => copy()}>
      <MessageCircle />
      Copy Message
    </ContextMenuItem>
  );
}

const DURATION_OPTIONS: { label: string; value: number }[] = [
  { label: "30 minutes", value: 1800 },
  { label: "1 hour", value: 3600 },
  { label: "6 hours", value: 21600 },
  { label: "12 hours", value: 43200 },
  { label: "1 day", value: 86400 },
  { label: "7 days", value: 604800 },
  { label: "Never", value: 0 },
];

const USES_OPTIONS: { label: string; value: number }[] = [
  { label: "1 use", value: 1 },
  { label: "5 uses", value: 5 },
  { label: "10 uses", value: 10 },
  { label: "25 uses", value: 25 },
  { label: "50 uses", value: 50 },
  { label: "100 uses", value: 100 },
  { label: "No limit", value: 0 },
];

export function InviteLink({ id }: { id: number | string | undefined }) {
  const [open, setOpen] = useState(false);
  const [maxAge, setMaxAge] = useState<number>(3600);
  const [maxUses, setMaxUses] = useState<number>(1);
  const [unique, setUnique] = useState(true);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setMaxAge(3600);
    setMaxUses(1);
    setUnique(true);
    setLink(null);
  }

  async function generate() {
    if (id === undefined) return;
    setBusy(true);
    try {
      const code = await getInviteCode(id, { maxAge, maxUses, unique });
      if (!code) throw new Error("Discord refused to create invite");
      const url = `discord.gg/${code}`;
      setLink(url);
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Invite copied", { description: url });
        setOpen(false);
      } catch {
        toast.message("Invite created", {
          description: "Clipboard blocked. Copy from the dialog.",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create invite";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ContextMenuItem
        disabled={id === undefined}
        onSelect={(e) => {
          e.preventDefault();
          reset();
          setOpen(true);
        }}
      >
        <UserRoundPlus />
        Invite Link
      </ContextMenuItem>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono tracking-tight">
              create invite
            </DialogTitle>
            <DialogDescription>
              Configure how long this invite is valid and how many people can
              use it.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <label
                htmlFor="invite-expires-after"
                className="text-[10px] uppercase tracking-[0.18em] font-mono text-muted-foreground"
              >
                Expires after
              </label>
              <Select
                value={String(maxAge)}
                onValueChange={(v) => setMaxAge(Number(v))}
              >
                <SelectTrigger id="invite-expires-after" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      <span>{o.label}</span>
                      <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                        {o.value === 0 ? "∞" : `${o.value}s`}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <label
                htmlFor="invite-max-uses"
                className="text-[10px] uppercase tracking-[0.18em] font-mono text-muted-foreground"
              >
                Max uses
              </label>
              <Select
                value={String(maxUses)}
                onValueChange={(v) => setMaxUses(Number(v))}
              >
                <SelectTrigger id="invite-max-uses" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USES_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      <span>{o.label}</span>
                      <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                        {o.value === 0 ? "∞" : `${o.value}x`}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 text-xs select-none cursor-pointer">
              <input
                type="checkbox"
                checked={unique}
                onChange={(e) => setUnique(e.target.checked)}
                className="size-3.5 accent-[oklch(0.7686_0.1647_70.08)]"
              />
              <span>Force a new code (do not reuse an existing one)</span>
            </label>

            {link && (
              <div className="border rounded-md bg-muted/40 px-3 py-2 flex items-center gap-2">
                <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                <code className="text-xs font-mono truncate flex-1">
                  {link}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() => {
                    navigator.clipboard.writeText(link);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="size-3" />
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Close
            </Button>
            <Button onClick={generate} disabled={busy || id === undefined}>
              {busy
                ? "Generating…"
                : link
                  ? "Generate another"
                  : "Generate & copy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
