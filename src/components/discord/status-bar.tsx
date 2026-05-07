"use client";

import { Activity, ExternalLink, Loader2, ShieldAlert, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";
import { useRealtimeStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { devPortalUrl, getMissingPrivilegedIntents } from "@/components/discord/intent-warning";

export function StatusBar() {
  const state = useRealtimeStore((s) => s.gatewayState);
  const ping = useRealtimeStore((s) => s.pingMs);
  const rest = useRealtimeStore((s) => s.restPingMs);
  const intents = useRealtimeStore((s) => s.activeIntents);
  const appId = useRealtimeStore((s) => s.user?.id);

  const missing = state === "ready" ? getMissingPrivilegedIntents(intents) : [];
  const degraded = missing.length > 0;

  const dot =
    state === "ready"
      ? degraded
        ? "bg-yellow-500"
        : ping < 150
          ? "bg-emerald-500"
          : ping < 350
            ? "bg-yellow-500"
            : "bg-red-500"
      : state === "disconnected"
        ? "bg-red-500"
        : "bg-yellow-500";

  const label =
    state === "ready"
      ? degraded
        ? "Limited"
        : "Live"
      : state === "disconnected"
        ? "Offline"
        : state === "reconnecting"
          ? "Reconnecting"
          : state === "resuming"
            ? "Resuming"
            : state === "identifying"
              ? "Connecting"
              : state === "connecting"
                ? "Connecting"
                : "Idle";

  const Icon = state === "ready" ? Wifi : state === "disconnected" ? WifiOff : Loader2;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="hidden sm:flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-mono px-2 py-1 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
          aria-label="Connection details"
        >
          <span className={cn("size-1.5 rounded-full", dot, state !== "ready" && "animate-pulse")} />
          <Icon
            className={cn(
              "size-3 text-muted-foreground",
              state !== "ready" && state !== "disconnected" && "animate-spin",
            )}
          />
          <span className="text-muted-foreground">{label}</span>
          {state === "ready" && (
            <span className="text-muted-foreground/70">· {ping || "—"}ms</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-80 p-0 overflow-hidden"
      >
        <div className="px-3 py-2.5 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Gateway</span>
            <span className="font-mono">{ping || "—"}ms</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">REST</span>
            <span className="font-mono">{rest || "—"}ms</span>
          </div>
          <div className="border-t border-border/50 pt-2 flex items-center gap-1.5">
            <Activity className="size-3.5" />
            <span className="font-medium">{label}</span>
          </div>
        </div>
        {degraded && (
          <div className="border-t bg-yellow-500/10 px-3 py-2.5 text-xs text-yellow-700 dark:text-yellow-400 space-y-2">
            <div className="flex items-start gap-1.5">
              <ShieldAlert className="size-3.5 shrink-0 mt-0.5" />
              <div className="font-medium leading-snug">
                Privileged intents disabled
              </div>
            </div>
            <ul className="pl-5 space-y-0.5 list-disc marker:text-yellow-600/70">
              {missing.map((m) => (
                <li key={m.key}>{m.label}</li>
              ))}
            </ul>
            <p className="text-yellow-700/90 dark:text-yellow-400/80 leading-snug">
              Enable these in the Developer Portal so the bot can read message content, members, and presence.
            </p>
            <Link
              href={devPortalUrl(appId)}
              target="_blank"
              className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
            >
              Open Dev Portal
              <ExternalLink className="size-3" />
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
