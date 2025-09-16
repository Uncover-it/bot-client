"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  LoaderCircle,
  ClockPlus,
  UserRoundMinus,
  Ban,
  Trash2,
  Pin,
  PinOff,
} from "lucide-react";
import {
  ban,
  deleteMessage,
  getMessages,
  pinMessage,
  unpinMessage,
} from "@/api/data/actions";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  CopyID,
  CopyMessage,
  CopyUsername,
} from "@/components/contextMenuHandellers";
import Link from "next/link";
import { setTimeout, kick } from "@/api/data/actions";

interface MessageProps {
  id: string;
  content: string;
  author: AuthorProps;
  pinned: boolean;
}

interface AuthorProps {
  username: string;
  bot: boolean;
  avatar: string;
  id: string;
}

function MessageSkeleton() {
  return (
    <div className="size-full absolute flex items-center text-center justify-center text-muted-foreground">
      <LoaderCircle className="animate-spin mr-2" />
      Loading
    </div>
  );
}

export function MessageList({
  channelId,
  serverId,
}: {
  channelId: string;
  serverId: string;
}) {
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const fetchedMessages = await getMessages(channelId);
        setMessages(fetchedMessages);
        setLoading(false);
      } catch {
        toast.error("Error", { description: "Failed to load messages" });
        setLoading(false);
      }
    };

    fetchMessages();

    const intervalId = setInterval(fetchMessages, 1500);

    return () => clearInterval(intervalId);
  }, [channelId]);

  if (loading) {
    return <MessageSkeleton />;
  }

  function timeout(userId: string, duration: number | null) {
    const timeoutPromise = async () => {
      let data;
      if (duration == null) {
        data = await setTimeout(serverId, userId, duration);
      } else {
        const date = new Date();
        date.setMinutes(date.getMinutes() + duration);
        const newDate = date.toISOString();
        data = await setTimeout(serverId, userId, newDate);
      }

      if (data.message) {
        throw new Error(data.message);
      }
    };

    toast.promise(timeoutPromise(), {
      loading: "Setting Timeout",
      success: () => {
        return `Timeout Set`;
      },
      error: (error) => {
        return `Error: ${error.message}`;
      },
    });
  }

  function messageDelete(messageId: string) {
    const deletePromise = async () => {
      await deleteMessage(channelId, messageId);
    };

    toast.promise(deletePromise(), {
      loading: "Deleting Message",
      success: () => {
        return `Message deleted`;
      },
    });
  }

  return (
    <div className="size-full flex flex-col-reverse justify-end p-4">
      {messages.map((message: MessageProps) => (
        <Message
          from={message.author.bot ? "user" : "assistant"}
          key={message.id}
        >
          <ContextMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <ContextMenuTrigger asChild>
                  <MessageAvatar
                    src={`https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}`}
                    name={message.author.username}
                  />
                </ContextMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{message.author.username}</TooltipContent>
            </Tooltip>
            <ContextMenuContent className="bg-sidebar font-mono tracking-tighter">
              {!message.author.bot && (
                <>
                  <ContextMenuSub>
                    <ContextMenuSubTrigger>
                      <ClockPlus />
                      Timeout
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="bg-sidebar">
                      <ContextMenuItem
                        onSelect={() => timeout(message.author.id, 1)}
                      >
                        1 Minute
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => timeout(message.author.id, 5)}
                      >
                        5 Minutes
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => timeout(message.author.id, 10)}
                      >
                        10 Minutes
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => timeout(message.author.id, 60)}
                      >
                        1 Hour
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => timeout(message.author.id, 1440)}
                      >
                        1 Day
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => timeout(message.author.id, 10080)}
                      >
                        1 Week
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onSelect={() => timeout(message.author.id, null)}
                        variant="destructive"
                      >
                        Unmute
                      </ContextMenuItem>
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                  <ContextMenuItem
                    onSelect={() => kick(serverId, message.author.id)}
                    variant="destructive"
                  >
                    <UserRoundMinus /> Kick
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() => ban(serverId, message.author.id)}
                    variant="destructive"
                  >
                    <Ban /> Ban
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                </>
              )}
              <CopyUsername username={message.author.username} />
              <CopyID id={Number(message.id)} />
              <Link
                href={`https://id.uncoverit.org?id=${message.author.id}`}
                target="_blank"
                className="cursor-not-allowed"
              >
                <ContextMenuItem>
                  <ExternalLink />
                  Lookup ID
                </ContextMenuItem>
              </Link>
            </ContextMenuContent>
          </ContextMenu>

          <ContextMenu>
            <ContextMenuTrigger asChild>
              <MessageContent>
                <Response>{message.content}</Response>
              </MessageContent>
            </ContextMenuTrigger>
            <ContextMenuContent className="bg-sidebar font-mono tracking-tighter">
              <ContextMenuItem
                onSelect={() => {
                  const pinPromise = async () => {
                    if (!message.pinned) {
                      await pinMessage(channelId, message.id);
                    } else {
                      await unpinMessage(channelId, message.id);
                    }
                  };

                  toast.promise(pinPromise(), {
                    loading: "Updating Message",
                    success: () => "Message Updated",
                  });
                }}
              >
                {!message.pinned ? (
                  <>
                    <Pin /> Pin
                  </>
                ) : (
                  <>
                    <PinOff /> Unpin
                  </>
                )}
              </ContextMenuItem>
              <ContextMenuItem
                variant="destructive"
                onSelect={() => messageDelete(message.id)}
              >
                <Trash2 /> Delete
              </ContextMenuItem>
              <ContextMenuSeparator />
              <CopyMessage message={message.content} />
              <CopyID id={message.id} />
            </ContextMenuContent>
          </ContextMenu>
        </Message>
      ))}
    </div>
  );
}
