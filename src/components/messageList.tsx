"use client";

import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  LoaderCircle,
  ClockPlus,
  UserRoundMinus,
  Ban,
  Trash2,
  Pin,
  PinOff,
  ImagePlus,
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
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MessageProps {
  id: string;
  content: string;
  author: AuthorProps;
  pinned: boolean;
  attachments?: Attachments[];
  embeds?: EmbedProps[];
}

interface AuthorProps {
  username: string;
  bot: boolean;
  avatar: string;
  id: string;
}

interface Attachments {
  content_type: string;
  proxy_url: string;
  filename: string;
  width: number;
  height: number;
  id: string;
  size: number;
}

interface EmbedProps {
  title?: string;
  description?: string;
  footer?: EmbedFooterProps;
  color?: number;
  author?: {
    name: string;
    proxy_icon_url?: string;
  };
  thumbnail?: {
    url: string;
  };
  image?: {
    url: string;
  };
}

interface EmbedFooterProps {
  text: string;
  proxy_icon_url?: string;
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialScrollDone = useRef(false);

  const findScrollParent = (el: HTMLElement | null) => {
    if (!el)
      return (document.scrollingElement ||
        document.documentElement) as HTMLElement;
    let parent: HTMLElement | null = el.parentElement;
    const overflowRegex = /(auto|scroll)/;
    while (parent) {
      try {
        const style = window.getComputedStyle(parent);
        if (
          overflowRegex.test(style.overflowY) ||
          overflowRegex.test(style.overflow)
        ) {
          return parent;
        }
      } catch {
        // ignore
      }
      parent = parent.parentElement;
    }
    return (document.scrollingElement ||
      document.documentElement) as HTMLElement;
  };

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

  useEffect(() => {
    if (!loading && !initialScrollDone.current) {
      const el = findScrollParent(containerRef.current);
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
      initialScrollDone.current = true;
    }
  }, [loading]);

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
    <div
      className="size-full flex flex-col-reverse justify-end p-4"
      ref={containerRef}
    >
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
                {message.embeds &&
                  message.embeds.map((embed, index) => (
                    <div
                      className="rounded-md overflow-hidden text-primary"
                      style={{
                        borderLeft: embed.color
                          ? `4px solid #${embed.color
                              .toString(16)
                              .padStart(6, "0")}`
                          : undefined,
                      }}
                      key={index}
                    >
                      <div className="bg-background p-3">
                        {embed.author && (
                          <div className="flex items-center gap-2 mb-1">
                            {embed.author.proxy_icon_url && (
                              <Image
                                src={embed.author.proxy_icon_url}
                                alt=""
                                className="rounded-full"
                                height={20}
                                width={20}
                              />
                            )}
                            <span className="text-sm font-medium">
                              {embed.author.name}
                            </span>
                          </div>
                        )}

                        <div>
                          {embed.title && (
                            <div className="font-semibold mb-1">
                              {embed.title}
                            </div>
                          )}
                          {embed.description && (
                            <Response className="text-sm ">
                              {embed.description}
                            </Response>
                          )}
                          {embed.image && (
                            <div className="mt-3">
                              <Image
                                src={embed.image.url}
                                alt=""
                                className="max-w-full rounded-md max-h-[300px] object-contain"
                              />
                            </div>
                          )}

                          {embed.thumbnail && (
                            <div>
                              <img
                                src={embed.thumbnail.url}
                                alt=""
                                className="rounded-md"
                              />
                            </div>
                          )}

                          {embed.footer && embed.footer.text && (
                            <div className="flex items-center gap-1 mt-3 text-xs">
                              {embed.footer.proxy_icon_url && (
                                <Image
                                  src={embed.footer.proxy_icon_url}
                                  alt=""
                                  className="rounded-full"
                                  width={20}
                                  height={20}
                                />
                              )}
                              <span>{embed.footer.text}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                {message.attachments &&
                  message.attachments.length > 0 &&
                  (() => {
                    const formatBytes = (bytes: number | null) => {
                      if (!bytes || bytes === 0) return "Unknown size";
                      const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
                      const i = Math.floor(Math.log(bytes) / Math.log(1024));
                      return `${parseFloat(
                        (bytes / Math.pow(1024, i)).toFixed(2)
                      )} ${sizes[i]}`;
                    };

                    return message.attachments
                      .map((attachment) => {
                        if (attachment.content_type.startsWith("image/")) {
                          return (
                            <ContextMenu key={attachment.id}>
                              <ContextMenuTrigger asChild>
                                <Link
                                  href={attachment.proxy_url}
                                  target="_blank"
                                >
                                  <Image
                                    src={attachment.proxy_url}
                                    alt={attachment.filename}
                                    unoptimized
                                    width={attachment.width}
                                    height={attachment.height}
                                    style={{ borderRadius: "12px" }}
                                  />
                                </Link>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="bg-sidebar font-mono tracking-tighter">
                                <ContextMenuItem
                                  onSelect={() => {
                                    navigator.clipboard.writeText(
                                      attachment.proxy_url
                                    );
                                    toast.success("Copied to clipboard");
                                  }}
                                >
                                  <ImagePlus />
                                  Copy URL
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <CopyID id={attachment.id} />
                              </ContextMenuContent>
                            </ContextMenu>
                          );
                        }

                        return (
                          <div
                            key={attachment.id}
                            className="w-full flex flex-col bg-background p-5 rounded-lg"
                          >
                            <span className="font-semibold text-md">
                              {attachment.filename}
                            </span>
                            <span className="text-muted-foreground font-mono tracking-tighter">
                              {formatBytes(attachment.size)}
                            </span>
                            <Link
                              href={attachment.proxy_url}
                              className={cn(
                                "mt-1",
                                buttonVariants({ size: "default" })
                              )}
                            >
                              Download
                            </Link>
                          </div>
                        );
                      })
                      .filter(Boolean);
                  })()}
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
