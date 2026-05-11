"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  createWebhook,
  deleteWebhook,
  getChannelWebhooks,
} from "@/api/data/actions";
import { Copy, Eye, EyeOff, Plus, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { avatarUrl } from "@/lib/discord/cdn";
import Spinner from "../ui/spinner";

interface WebhookData {
  id: string;
  type: number;
  channel_id: string;
  guild_id?: string;
  name: string | null;
  avatar?: string | null;
  token?: string | null;
  application_id?: string | null;
  user?: {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
  };
}

interface Props {
  channelId: string;
  canManage: boolean;
}

export function WebhooksSection({ channelId, canManage }: Props) {
  const [hooks, setHooks] = useState<WebhookData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError(null);
    setRevealed(new Set());
    (async () => {
      const res = await getChannelWebhooks(channelId);
      if (!alive) return;
      if (Array.isArray(res)) {
        setHooks(res);
      } else if (res && typeof res === "object" && "error" in res) {
        setError((res as { error: string }).error);
        setHooks([]);
      }
      setBusy(false);
    })();
    return () => {
      alive = false;
    };
  }, [channelId]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name || !canManage) return;
    setCreating(true);
    try {
      const res = await createWebhook(channelId, name);
      if (!res?.id) throw new Error(res?.message ?? "Failed to create webhook");
      setHooks((cur) => [res, ...(cur ?? [])]);
      setNewName("");
      setRevealed((cur) => new Set(cur).add(res.id));
      toast.success("Webhook created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create webhook");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(hook: WebhookData) {
    if (!canManage) return;
    if (!confirm(`Delete webhook "${hook.name ?? hook.id}"?`)) return;
    try {
      const res = await deleteWebhook(hook.id);
      if (res && "ok" in res && res.ok) {
        setHooks((cur) => (cur ?? []).filter((h) => h.id !== hook.id));
        toast.success("Webhook deleted");
        return;
      }
      throw new Error("Delete failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  function toggleReveal(id: string) {
    setRevealed((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function copyUrl(hook: WebhookData) {
    if (!hook.token) {
      toast.error("This webhook has no token (may belong to an integration)");
      return;
    }
    const url = `https://discord.com/api/webhooks/${hook.id}/${hook.token}`;
    navigator.clipboard.writeText(url);
    toast.success("Webhook URL copied");
  }

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex items-center gap-2">
        <Webhook className="size-4" />
        <Label className="text-sm font-semibold">Webhooks</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Webhook URLs let external services post messages without a bot.
      </p>

      {canManage && (
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label className="text-[10px] uppercase tracking-[0.18em] font-mono text-muted-foreground">
              New webhook name
            </Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="GitHub deploys"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim() && !creating) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
          >
            {creating ? (
              <Spinner className="size-4" />
            ) : (
              <Plus className="size-4" />
            )}
            <span className="ml-1">Create</span>
          </Button>
        </div>
      )}

      {!canManage && (
        <p className="text-xs text-muted-foreground italic">
          Bot lacks Manage Webhooks permission. Read-only.
        </p>
      )}

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {busy && hooks === null ? (
        <div className="text-sm text-muted-foreground flex items-center gap-1">
          <Spinner className="size-3" /> Loading webhooks…
        </div>
      ) : hooks && hooks.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No webhooks yet.</p>
      ) : (
        <TooltipProvider delayDuration={400}>
          <ul className="border rounded-md divide-y max-h-64 overflow-y-auto">
            {(hooks ?? []).map((h) => {
              const showToken = revealed.has(h.id);
              const url = h.token
                ? `https://discord.com/api/webhooks/${h.id}/${h.token}`
                : null;
              return (
                <li key={h.id} className="p-3 flex gap-3 items-start">
                  <div className="size-9 rounded-full bg-muted overflow-hidden grid place-items-center shrink-0">
                    {h.avatar ? (
                      <Image
                        src={avatarUrl(h.id, h.avatar)}
                        alt={h.name ?? "webhook"}
                        width={36}
                        height={36}
                        unoptimized
                      />
                    ) : (
                      <Webhook className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-medium truncate">
                        {h.name ?? "Unnamed"}
                      </span>
                      {h.application_id && (
                        <span className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">
                          app
                        </span>
                      )}
                      {h.user && (
                        <span className="text-xs text-muted-foreground truncate">
                          by @{h.user.username}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate">
                      {h.id}
                    </div>
                    <div className="mt-1.5 flex items-start gap-1 min-w-0">
                      {url ? (
                        <span className="block text-[10px] font-mono bg-muted/50 rounded px-1.5 py-1 break-all flex-1 min-w-0 leading-snug">
                          {showToken
                            ? url
                            : url.replace(/\/[^/]+$/, "/••••••••")}
                        </span>
                      ) : (
                        <span className="block text-[10px] text-muted-foreground italic flex-1 min-w-0">
                          No URL exposed (managed by an application).
                        </span>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        {url && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  onClick={() => toggleReveal(h.id)}
                                >
                                  {showToken ? (
                                    <EyeOff className="size-3" />
                                  ) : (
                                    <Eye className="size-3" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {showToken ? "Hide" : "Reveal"}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  onClick={() => copyUrl(h)}
                                >
                                  <Copy className="size-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy URL</TooltipContent>
                            </Tooltip>
                          </>
                        )}
                        {canManage && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDelete(h)}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete webhook</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </TooltipProvider>
      )}
    </div>
  );
}
