"use client";

import { Activity, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useRealtimeStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { INTENTS } from "@/lib/discord/constants";

export function StatusBar() {
  const state = useRealtimeStore((s) => s.gatewayState);
  const ping = useRealtimeStore((s) => s.pingMs);
  const rest = useRealtimeStore((s) => s.restPingMs);
  const intents = useRealtimeStore((s) => s.activeIntents);
  const degraded =
    state === "ready" &&
    !((intents & INTENTS.GUILD_MEMBERS) && (intents & INTENTS.GUILD_PRESENCES) && (intents & INTENTS.MESSAGE_CONTENT));

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
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="hidden sm:flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-mono px-2 py-1 rounded-md hover:bg-muted/50 cursor-default transition-colors">
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
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="text-xs space-y-1 min-w-32">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Gateway</span>
            <span className="font-mono">{ping || "—"}ms</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">REST</span>
            <span className="font-mono">{rest || "—"}ms</span>
          </div>
          <div className="border-t border-border/50 pt-1 flex items-center gap-1">
            <Activity className="size-3" />
            <span>{label}</span>
          </div>
          {degraded && (
            <div className="text-[10px] text-yellow-600 dark:text-yellow-500">
              Privileged intents disabled — enable in Dev Portal for member list, presence, message content.
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
