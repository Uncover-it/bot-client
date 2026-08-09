"use client";

import { useEffect, useRef, useState } from "react";
import {
  DialogClose,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getBotInfo,
  getCurrentApplication,
  updateApplication,
  updateBotInfo,
} from "@/api/data/actions";
import { useRealtimeStore } from "@/lib/store";
import { getGateway } from "@/hooks/use-gateway";
import { avatarUrl } from "@/lib/discord/cdn";
import Image from "next/image";
import { ImagePlus, Trash2 } from "lucide-react";

type Status = "online" | "idle" | "dnd" | "invisible";

const STATUS_LABEL: Record<Status, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  invisible: "Invisible",
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function BotSettings() {
  const user = useRealtimeStore((s) => s.user);
  const setUser = useRealtimeStore((s) => s.setUser);

  const [username, setUsername] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("online");
  const [activityText, setActivityText] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<string | null | undefined>(
    undefined,
  );
  const [pendingBanner, setPendingBanner] = useState<string | null | undefined>(
    undefined,
  );
  const [pendingIcon, setPendingIcon] = useState<string | null | undefined>(
    undefined,
  );
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await getBotInfo();
        if (!alive) return;
        if (me?.id) {
          setUsername(me.username ?? "");
          if (me.avatar) setAvatarPreview(avatarUrl(me.id, me.avatar, 256));
          if (me.banner) {
            const ext = me.banner.startsWith("a_") ? "gif" : "png";
            setBannerPreview(
              `https://cdn.discordapp.com/banners/${me.id}/${me.banner}.${ext}?size=512`,
            );
          }
        }
        const app = await getCurrentApplication();
        if (!alive) return;
        if (app?.id) {
          setDescription(app.description ?? "");
          if (app.icon) {
            const ext = app.icon.startsWith("a_") ? "gif" : "png";
            setIconPreview(
              `https://cdn.discordapp.com/app-icons/${app.id}/${app.icon}.${ext}?size=256`,
            );
          }
        }
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function pickFile(
    file: File | undefined,
    setPreview: (url: string | null) => void,
    setPending: (data: string | null | undefined) => void,
  ) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8MB");
      return;
    }
    const data = await fileToDataUrl(file);
    setPreview(data);
    setPending(data);
  }

  async function save() {
    setBusy(true);
    const ops: Promise<unknown>[] = [];
    const summary: string[] = [];

    const userPatch: Record<string, string | null> = {};
    if (username && username !== user?.username) {
      userPatch.username = username;
      summary.push("username");
    }
    if (pendingAvatar !== undefined) {
      userPatch.avatar = pendingAvatar;
      summary.push("avatar");
    }
    if (pendingBanner !== undefined) {
      userPatch.banner = pendingBanner;
      summary.push("banner");
    }
    if (Object.keys(userPatch).length > 0) {
      ops.push(
        updateBotInfo(userPatch).then((res) => {
          if (res?.id) setUser({ ...res, discriminator: "0" });
          else if (res?.message) throw new Error(res.message);
        }),
      );
    }

    const appPatch: Record<string, string | null> = {};
    if (description !== undefined) appPatch.description = description;
    if (pendingIcon !== undefined) {
      appPatch.icon = pendingIcon;
      summary.push("app icon");
    }
    if (Object.keys(appPatch).length > 0) {
      ops.push(
        updateApplication(appPatch).then((res) => {
          if (res?.message && !res?.id) throw new Error(res.message);
        }),
      );
    }

    const gw = getGateway();
    if (gw) {
      gw.updatePresence(status, activityText || undefined);
      summary.push("status");
    }

    if (ops.length === 0 && summary.length === 0) {
      toast.message("Nothing to save");
      setBusy(false);
      return;
    }

    try {
      await Promise.all(ops);
      toast.success(`Saved: ${summary.join(", ") || "preferences"}`);
      setPendingAvatar(undefined);
      setPendingBanner(undefined);
      setPendingIcon(undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      toast.error(`Error: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Bot settings</DialogTitle>
        <DialogDescription>
          Edit profile, presence, and app metadata.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5 mt-4">
        <section className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">
            Profile
          </h3>

          <div className="space-y-2">
            <Label>Banner</Label>
            <div
              className="relative w-full h-20 rounded-md border bg-muted overflow-hidden group"
              style={
                bannerPreview
                  ? {
                      backgroundImage: `url(${bannerPreview})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : undefined
              }
            >
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-white text-xs cursor-pointer"
              >
                <span className="inline-flex items-center gap-1">
                  <ImagePlus className="size-3" /> Upload banner
                </span>
              </button>
              {bannerPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setBannerPreview(null);
                    setPendingBanner(null);
                  }}
                  className="absolute top-1 right-1 size-6 grid place-items-center rounded-full bg-background/80 hover:bg-destructive/80 hover:text-white transition"
                  aria-label="Remove banner"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(e) => {
                pickFile(
                  e.target.files?.[0],
                  setBannerPreview,
                  setPendingBanner,
                );
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex items-start gap-3">
            <div className="space-y-2">
              <Label>Avatar</Label>
              <button
                type="button"
                aria-label="Change avatar"
                className="size-20 rounded-full ring-2 ring-border bg-muted overflow-hidden cursor-pointer relative group"
                onClick={() => avatarInputRef.current?.click()}
              >
                {avatarPreview ? (
                  <Image
                    src={avatarPreview}
                    alt="avatar"
                    width={80}
                    height={80}
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="size-full grid place-items-center text-xs text-muted-foreground">
                    no avatar
                  </div>
                )}
                <div className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 group-hover:opacity-100 transition text-white">
                  <ImagePlus className="size-4" />
                </div>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  pickFile(
                    e.target.files?.[0],
                    setAvatarPreview,
                    setPendingAvatar,
                  );
                  e.target.value = "";
                }}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="bot username"
              />
              {avatarPreview && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-xs h-6 -ml-2"
                  onClick={() => {
                    setAvatarPreview(null);
                    setPendingAvatar(null);
                  }}
                >
                  <Trash2 className="size-3 mr-1" /> Remove avatar
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">
            Presence
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as Status)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Playing</Label>
              <Input
                value={activityText}
                onChange={(e) => setActivityText(e.target.value)}
                placeholder="custom activity (e.g. with code)"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Status sent over gateway. Persists until next restart unless
            re-applied.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">
            Application
          </h3>
          <div className="flex items-start gap-3">
            <div className="space-y-2">
              <Label>App icon</Label>
              <button
                type="button"
                aria-label="Change app icon"
                className="size-16 rounded-xl ring-2 ring-border bg-muted overflow-hidden cursor-pointer relative group"
                onClick={() => iconInputRef.current?.click()}
              >
                {iconPreview ? (
                  <Image
                    src={iconPreview}
                    alt="app icon"
                    width={64}
                    height={64}
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="size-full grid place-items-center text-xs text-muted-foreground">
                    none
                  </div>
                )}
                <div className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 group-hover:opacity-100 transition text-white">
                  <ImagePlus className="size-4" />
                </div>
              </button>
              <input
                ref={iconInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  pickFile(e.target.files?.[0], setIconPreview, setPendingIcon);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="public bot description"
                maxLength={400}
                className="min-h-20"
              />
              <p className="text-[11px] text-muted-foreground text-right">
                {description.length}/400
              </p>
            </div>
          </div>
        </section>
      </div>

      <DialogFooter className="mt-6">
        <DialogClose asChild>
          <Button variant="outline">Close</Button>
        </DialogClose>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </div>
  );
}
