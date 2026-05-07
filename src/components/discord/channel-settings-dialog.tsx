"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateChannel, deleteChannel } from "@/api/data/actions";
import { useRealtimeStore } from "@/lib/store";
import { useGuildPermissions } from "@/hooks/use-permissions";
import { can } from "@/lib/discord/permissions";
import { CHANNEL_TYPE } from "@/lib/discord/constants";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Channel } from "@/lib/discord/types";

interface Props {
  guildId: string;
  channel: Channel;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const ARCHIVE_OPTIONS = [
  { value: 60, label: "1 hour" },
  { value: 1440, label: "1 day" },
  { value: 4320, label: "3 days" },
  { value: 10080, label: "1 week" },
];

export function ChannelSettingsDialog({ guildId, channel, open, onOpenChange }: Props) {
  const isVoice =
    channel.type === CHANNEL_TYPE.GUILD_VOICE ||
    channel.type === CHANNEL_TYPE.GUILD_STAGE_VOICE;
  const isForum =
    channel.type === CHANNEL_TYPE.GUILD_FORUM ||
    channel.type === CHANNEL_TYPE.GUILD_MEDIA;
  const isText =
    channel.type === CHANNEL_TYPE.GUILD_TEXT ||
    channel.type === CHANNEL_TYPE.GUILD_ANNOUNCEMENT;
  const isCategory = channel.type === CHANNEL_TYPE.GUILD_CATEGORY;

  const [name, setName] = useState(channel.name ?? "");
  const [topic, setTopic] = useState(channel.topic ?? "");
  const [slowmode, setSlowmode] = useState(channel.rate_limit_per_user ?? 0);
  const [nsfw, setNsfw] = useState(channel.nsfw ?? false);
  const [bitrate, setBitrate] = useState(channel.bitrate ?? 64000);
  const [userLimit, setUserLimit] = useState(channel.user_limit ?? 0);
  const [autoArchive, setAutoArchive] = useState(
    channel.default_auto_archive_duration ?? 1440,
  );
  const [threadSlow, setThreadSlow] = useState(
    channel.default_thread_rate_limit_per_user ?? 0,
  );
  const [busy, setBusy] = useState(false);
  const upsertChannel = useRealtimeStore((s) => s.upsertChannel);
  const removeChannel = useRealtimeStore((s) => s.removeChannel);
  const perms = useGuildPermissions(guildId);
  const canManage = can(perms, "Manage Channels");

  async function save() {
    if (!canManage) return;
    setBusy(true);
    const patch: Parameters<typeof updateChannel>[1] = { name };
    if (!isCategory) patch.topic = topic;
    if (isText || isForum) patch.nsfw = nsfw;
    if (isText) patch.rate_limit_per_user = slowmode;
    if (isVoice) {
      patch.bitrate = bitrate;
      patch.user_limit = userLimit;
    }
    if (isForum) {
      patch.default_auto_archive_duration = autoArchive;
      patch.default_thread_rate_limit_per_user = threadSlow;
    }

    const p = async () => {
      const res: Channel = await updateChannel(channel.id, patch);
      if (!res?.id) throw new Error("Update failed");
      upsertChannel(res);
      onOpenChange(false);
    };
    toast.promise(p(), { loading: "Saving", success: "Saved", error: (e) => `Error: ${e.message}` });
    p().finally(() => setBusy(false));
  }

  async function destroy() {
    if (!canManage) return;
    if (!confirm(`Delete #${channel.name}? This is irreversible.`)) return;
    const p = async () => {
      const res = await deleteChannel(channel.id);
      if (res?.message) throw new Error(res.message);
      removeChannel(channel.id, guildId);
      onOpenChange(false);
    };
    toast.promise(p(), { loading: "Deleting", success: "Deleted", error: (e) => `Error: ${e.message}` });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Channel settings</DialogTitle>
          <DialogDescription className="font-mono text-xs break-all">
            #{channel.name} · {channel.id}
          </DialogDescription>
        </DialogHeader>
        {!canManage && (
          <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            Bot lacks Manage Channels permission. Read-only.
          </p>
        )}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canManage}
            />
          </div>

          {!isCategory && !isVoice && (
            <div className="space-y-1.5">
              <Label>{isForum ? "Guidelines" : "Topic"}</Label>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={!canManage}
                maxLength={isForum ? 4096 : 1024}
                className="min-h-20"
              />
              <p className="text-[11px] text-muted-foreground text-right">
                {topic.length}/{isForum ? 4096 : 1024}
              </p>
            </div>
          )}

          {isText && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Slowmode (seconds)</Label>
                <Input
                  type="number"
                  value={slowmode}
                  min={0}
                  max={21600}
                  onChange={(e) => setSlowmode(Number(e.target.value))}
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-1.5">
                <Label>NSFW</Label>
                <Button
                  variant={nsfw ? "default" : "outline"}
                  onClick={() => setNsfw((v) => !v)}
                  disabled={!canManage}
                  className="w-full"
                >
                  {nsfw ? "Age-restricted" : "Off"}
                </Button>
              </div>
            </div>
          )}

          {isVoice && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bitrate (bps)</Label>
                <Input
                  type="number"
                  value={bitrate}
                  min={8000}
                  max={384000}
                  step={1000}
                  onChange={(e) => setBitrate(Number(e.target.value))}
                  disabled={!canManage}
                />
                <p className="text-[10px] text-muted-foreground">
                  {Math.round(bitrate / 1000)} kbps
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>User limit</Label>
                <Input
                  type="number"
                  value={userLimit}
                  min={0}
                  max={99}
                  onChange={(e) => setUserLimit(Number(e.target.value))}
                  disabled={!canManage}
                />
                <p className="text-[10px] text-muted-foreground">
                  0 = no limit
                </p>
              </div>
            </div>
          )}

          {isForum && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>NSFW</Label>
                  <Button
                    variant={nsfw ? "default" : "outline"}
                    onClick={() => setNsfw((v) => !v)}
                    disabled={!canManage}
                    className="w-full"
                  >
                    {nsfw ? "Age-restricted" : "Off"}
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label>Default auto-archive</Label>
                  <Select
                    value={String(autoArchive)}
                    onValueChange={(v) => setAutoArchive(Number(v))}
                    disabled={!canManage}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ARCHIVE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={String(o.value)}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Default thread slowmode (seconds)</Label>
                <Input
                  type="number"
                  value={threadSlow}
                  min={0}
                  max={21600}
                  onChange={(e) => setThreadSlow(Number(e.target.value))}
                  disabled={!canManage}
                />
              </div>
              {channel.available_tags && channel.available_tags.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {channel.available_tags.map((t) => (
                      <span
                        key={t.id}
                        className="px-2 py-0.5 rounded-full text-[11px] border bg-muted/30"
                      >
                        {t.emoji_name ? `${t.emoji_name} ` : ""}
                        {t.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Tag editing not yet supported.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="flex sm:justify-between">
          {canManage && (
            <Button variant="destructive" onClick={destroy} className="mr-auto">
              <Trash2 className="size-4 mr-1" /> Delete channel
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!canManage || busy}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
