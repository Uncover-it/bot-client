"use client";

import { useEffect, useState } from "react";
import {
  FileImage,
  Hash,
  Megaphone,
  MessageSquareText,
  Mic,
  Radio,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MessageList } from "@/components/discord/message-list";
import {
  MessageInput,
  type ReplyTarget,
} from "@/components/discord/message-input";
import { MemberList } from "@/components/discord/member-list";
import { StatusBar } from "@/components/discord/status-bar";
import { ForumView } from "@/components/discord/forum-view";
import { VoiceView } from "@/components/discord/voice-view";
import { useRealtimeStore } from "@/lib/store";
import { getGateway } from "@/hooks/use-gateway";
import { getChannel, getGuildMembers } from "@/api/data/actions";
import { CHANNEL_TYPE, INTENTS } from "@/lib/discord/constants";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import type { GuildMember } from "@/lib/discord/types";

interface Props {
  serverId: string;
  channelId: string;
}

export function ChannelView({ serverId, channelId }: Props) {
  const [memberOverride, setMemberOverride] = useState<boolean | null>(null);
  const [mobileSheet, setMobileSheet] = useState(false);
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  const isMobile = useIsMobile();
  useKeyboardInset();
  const showMembers = memberOverride !== null ? memberOverride : !isMobile;

  const guild = useRealtimeStore((s) => s.guilds.get(serverId));
  const channel = guild?.channels?.find((c) => c.id === channelId);
  const membersLen = useRealtimeStore(
    (s) => s.members.get(serverId)?.length ?? 0,
  );
  const setMembers = useRealtimeStore((s) => s.setMembers);
  const upsertChannel = useRealtimeStore((s) => s.upsertChannel);
  const activeIntents = useRealtimeStore((s) => s.activeIntents);

  useEffect(() => {
    if (channel) return;
    let alive = true;
    (async () => {
      try {
        const data = await getChannel(channelId);
        if (alive && data && typeof data === "object" && "id" in data) {
          if (!data.guild_id) data.guild_id = serverId;
          upsertChannel(data);
        }
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [channelId, serverId, channel, upsertChannel]);

  // Sole loader of guild members. MemberList reads them from the store and
  // deliberately does not fetch, since this component is always its parent.
  useEffect(() => {
    if (membersLen > 0) return;
    let alive = true;
    const hasMembersIntent = (activeIntents & INTENTS.GUILD_MEMBERS) !== 0;
    // Returns false when the socket is not open yet, in which case fall
    // through to REST rather than losing the request.
    if (
      hasMembersIntent &&
      getGateway()?.requestGuildMembers(serverId, "", 0)
    ) {
      return;
    }
    (async () => {
      try {
        const data: GuildMember[] = await getGuildMembers(serverId, 1000);
        if (alive && Array.isArray(data)) setMembers(serverId, data);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [serverId, membersLen, activeIntents, setMembers]);

  const Icon =
    channel?.type === CHANNEL_TYPE.GUILD_VOICE
      ? Mic
      : channel?.type === CHANNEL_TYPE.GUILD_STAGE_VOICE
        ? Radio
        : channel?.type === CHANNEL_TYPE.GUILD_ANNOUNCEMENT
          ? Megaphone
          : channel?.type === CHANNEL_TYPE.GUILD_FORUM
            ? MessageSquareText
            : channel?.type === CHANNEL_TYPE.GUILD_MEDIA
              ? FileImage
              : Hash;

  const isForum =
    channel?.type === CHANNEL_TYPE.GUILD_FORUM ||
    channel?.type === CHANNEL_TYPE.GUILD_MEDIA;
  const isVoice =
    channel?.type === CHANNEL_TYPE.GUILD_VOICE ||
    channel?.type === CHANNEL_TYPE.GUILD_STAGE_VOICE;
  const isText = !isForum && !isVoice;
  const isThread =
    channel?.type === CHANNEL_TYPE.PUBLIC_THREAD ||
    channel?.type === CHANNEL_TYPE.PRIVATE_THREAD ||
    channel?.type === CHANNEL_TYPE.ANNOUNCEMENT_THREAD;
  const parent = channel?.parent_id
    ? guild?.channels?.find((c) => c.id === channel.parent_id)
    : undefined;
  const parentIsForum =
    parent?.type === CHANNEL_TYPE.GUILD_FORUM ||
    parent?.type === CHANNEL_TYPE.GUILD_MEDIA;
  const postStarterId = isThread && parentIsForum ? channelId : undefined;

  return (
    <div
      className="flex w-full overflow-hidden"
      style={{ height: "calc(100dvh - var(--kb, 0px))" }}
    >
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-12 shrink-0 border-b flex items-center pl-12 pr-2 md:pl-12 md:pr-4 gap-2 md:gap-3 bg-background/80 backdrop-blur-sm min-w-0">
          <Icon className="size-4 text-muted-foreground shrink-0" />
          <span className="font-semibold truncate whitespace-nowrap min-w-0 shrink basis-auto max-w-[40vw] md:max-w-[260px]">
            {channel?.name ?? "channel"}
          </span>
          {channel?.topic && (
            <>
              <span className="text-muted-foreground hidden md:inline shrink-0">
                |
              </span>
              <span
                className="text-sm text-muted-foreground truncate whitespace-nowrap hidden md:inline min-w-0 flex-1"
                title={channel.topic}
              >
                {channel.topic}
              </span>
            </>
          )}
          {!channel?.topic && <div className="flex-1" />}
          <StatusBar />
          {isMobile ? (
            <Sheet open={mobileSheet} onOpenChange={setMobileSheet}>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost" className="shrink-0">
                  <Users className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="p-0 w-[85vw] max-w-sm">
                <SheetHeader className="sr-only">
                  <SheetTitle>Members</SheetTitle>
                </SheetHeader>
                <MemberList guildId={serverId} />
              </SheetContent>
            </Sheet>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setMemberOverride(!showMembers)}
              className={cn("shrink-0", showMembers && "text-primary")}
            >
              <Users className="size-4" />
            </Button>
          )}
        </header>
        {isText && (
          <>
            <MessageList
              channelId={channelId}
              serverId={serverId}
              channelName={channel?.name}
              postStarterId={postStarterId}
              onReply={setReply}
            />
            <footer className="shrink-0 p-2 md:p-3 pt-3 pb-safe md:pb-3 border-t">
              <MessageInput
                channelId={channelId}
                serverId={serverId}
                channelName={channel?.name}
                reply={reply}
                onClearReply={() => setReply(null)}
              />
            </footer>
          </>
        )}
        {isForum && channel && (
          <ForumView guildId={serverId} channel={channel} />
        )}
        {isVoice && channel && <VoiceView channel={channel} />}
      </main>
      {!isMobile && showMembers && <MemberList guildId={serverId} />}
    </div>
  );
}
