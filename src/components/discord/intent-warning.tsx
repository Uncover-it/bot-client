"use client";

import { ExternalLink, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRealtimeStore } from "@/lib/store";
import { INTENTS } from "@/lib/discord/constants";
import { cn } from "@/lib/utils";

export function getMissingPrivilegedIntents(active: number) {
  const missing: { key: "members" | "presence" | "content"; label: string }[] = [];
  if (!(active & INTENTS.GUILD_MEMBERS))
    missing.push({ key: "members", label: "Server Members" });
  if (!(active & INTENTS.GUILD_PRESENCES))
    missing.push({ key: "presence", label: "Presence" });
  if (!(active & INTENTS.MESSAGE_CONTENT))
    missing.push({ key: "content", label: "Message Content" });
  return missing;
}

export function devPortalUrl(appId: string | undefined) {
  return appId
    ? `https://discord.com/developers/applications/${appId}/bot`
    : "https://discord.com/developers/applications";
}

interface BannerProps {
  reason: "content" | "members" | "presence";
  className?: string;
}

export function IntentBanner({ reason, className }: BannerProps) {
  const intents = useRealtimeStore((s) => s.activeIntents);
  const state = useRealtimeStore((s) => s.gatewayState);
  const appId = useRealtimeStore((s) => s.user?.id);

  const flag =
    reason === "content"
      ? INTENTS.MESSAGE_CONTENT
      : reason === "members"
        ? INTENTS.GUILD_MEMBERS
        : INTENTS.GUILD_PRESENCES;

  if (state !== "ready") return null;
  if (intents & flag) return null;

  const text =
    reason === "content"
      ? "Message Content Intent is disabled. Messages from other users will appear empty until you enable it in the Discord Developer Portal."
      : reason === "members"
        ? "Server Members Intent is disabled. The full member list cannot be loaded until you enable it in the Discord Developer Portal."
        : "Presence Intent is disabled. Online status will not appear until you enable it in the Discord Developer Portal.";

  return (
    <div
      className={cn(
        "flex items-start gap-2 px-3 py-2 text-xs border-b bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
        className,
      )}
    >
      <ShieldAlert className="size-4 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">{text}</div>
      <Link
        href={devPortalUrl(appId)}
        target="_blank"
        className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline shrink-0"
      >
        Open Dev Portal
        <ExternalLink className="size-3" />
      </Link>
    </div>
  );
}
