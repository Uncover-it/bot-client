"use client";

import { Mic, Radio, Volume2 } from "lucide-react";
import type { Channel } from "@/lib/discord/types";
import { CHANNEL_TYPE } from "@/lib/discord/constants";

interface Props {
  channel: Channel;
}

export function VoiceView({ channel }: Props) {
  const isStage = channel.type === CHANNEL_TYPE.GUILD_STAGE_VOICE;
  const Icon = isStage ? Radio : Mic;

  return (
    <div className="flex-1 min-h-0 grid place-items-center p-6">
      <div className="text-center max-w-md space-y-3">
        <div className="size-16 rounded-full bg-muted/40 grid place-items-center mx-auto">
          <Icon className="size-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">{channel.name}</h2>
        <p className="text-sm text-muted-foreground">
          {isStage ? "Stage" : "Voice"} channels are read-only here. Bot voice connections aren&apos;t supported in this client.
        </p>
        {channel.bitrate && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground font-mono">
            <Volume2 className="size-3" /> {Math.round(channel.bitrate / 1000)} kbps
            {channel.user_limit ? ` · limit ${channel.user_limit}` : ""}
          </div>
        )}
        {channel.topic && (
          <p className="text-xs text-muted-foreground italic break-words border-t pt-3">
            {channel.topic}
          </p>
        )}
      </div>
    </div>
  );
}
