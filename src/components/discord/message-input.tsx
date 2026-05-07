"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import {
  CornerUpLeft,
  Mic,
  Paperclip,
  Plus,
  SendHorizontal,
  SmilePlus,
  Sticker,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import StickerList from "@/components/stickerList";
import { EmojiPickerPro } from "@/components/discord/emoji-picker-pro";
import {
  getGuildMembers,
  sendMessage,
  searchGuildMembers,
  triggerTyping,
} from "@/api/data/actions";
import { DiscordAvatar } from "@/components/ui/discord-avatar";
import { avatarUrl } from "@/lib/discord/cdn";
import { Hash } from "lucide-react";
import type { GuildMember } from "@/lib/discord/types";
import { useRealtimeStore } from "@/lib/store";
import { useChannelPermissions } from "@/hooks/use-permissions";
import { useHydrated } from "@/hooks/use-hydrated";
import { can } from "@/lib/discord/permissions";
import { CHANNEL_TYPE } from "@/lib/discord/constants";
import { toast } from "sonner";
import Image from "next/image";

interface Attached {
  id: string;
  file: File;
  url: string;
}

export interface ReplyTarget {
  id: string;
  author: string;
  content: string;
}

interface Props {
  channelId: string;
  serverId: string;
  channelName?: string;
  reply?: ReplyTarget | null;
  onClearReply?: () => void;
}

interface Suggestion {
  type: "user" | "channel";
  id: string;
  label: string;
  sub?: string;
  insert: string;
  avatar?: string;
  color?: string;
}

export function MessageInput({
  channelId,
  serverId,
  channelName,
  reply,
  onClearReply,
}: Props) {
  const [text, setText] = useState("");
  const [tts, setTts] = useState(false);
  const [files, setFiles] = useState<Attached[]>([]);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [activeSugg, setActiveSugg] = useState(0);
  const [trigger, setTrigger] = useState<{
    char: "@" | "#" | null;
    start: number;
    query: string;
  }>({ char: null, start: 0, query: "" });
  const fileInput = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const guild = useRealtimeStore((s) => s.guilds.get(serverId));
  const guildRoles = useMemo(() => guild?.roles ?? [], [guild?.roles]);
  const membersRaw = useRealtimeStore((s) => s.members.get(serverId));
  const members = useMemo(() => membersRaw ?? [], [membersRaw]);
  const channels = useMemo(() => guild?.channels ?? [], [guild?.channels]);
  const channelMessages = useRealtimeStore((s) => s.messages.get(channelId));
  const upsertMember = useRealtimeStore((s) => s.upsertMember);
  const [remoteMembers, setRemoteMembers] = useState<GuildMember[]>([]);

  const recentAuthorIds = useMemo(() => {
    if (!channelMessages?.length) return [] as string[];
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (let i = 0; i < channelMessages.length && ordered.length < 12; i++) {
      const id = channelMessages[i].author?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ordered.push(id);
    }
    return ordered;
  }, [channelMessages]);
  const perms = useChannelPermissions(serverId, channelId);
  const hydrated = useHydrated();
  const canSend = hydrated ? can(perms, "Send Messages") : true;
  const canAttach = hydrated ? can(perms, "Attach Files") : true;
  const canEmbed = hydrated ? can(perms, "Embed Links") : true;
  const slowmode = channels.find((c) => c.id === channelId)?.rate_limit_per_user ?? 0;

  useEffect(() => {
    return () => {
      files.forEach((f) => URL.revokeObjectURL(f.url));
    };
  }, [files]);

  useEffect(() => {
    taRef.current?.focus();
  }, [channelId, reply]);

  const addFiles = useCallback((list: FileList | File[]) => {
    if (!canAttach) {
      toast.error("Bot lacks Attach Files permission");
      return;
    }
    const next: Attached[] = Array.from(list).map((file) => ({
      id: nanoid(),
      file,
      url: URL.createObjectURL(file),
    }));
    setFiles((prev) => [...prev, ...next]);
  }, [canAttach]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.files?.length) return;
      addFiles(e.clipboardData.files);
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.files?.length) {
        e.preventDefault();
        addFiles(e.dataTransfer.files);
      }
    };
    document.addEventListener("paste", onPaste);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [addFiles]);

  function removeFile(id: string) {
    setFiles((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f) URL.revokeObjectURL(f.url);
      return prev.filter((x) => x.id !== id);
    });
  }

  async function notifyTyping() {
    const now = Date.now();
    if (now - lastTyping.current < 8000) return;
    lastTyping.current = now;
    try {
      await triggerTyping(channelId);
    } catch {}
  }

  function detectTrigger(value: string, caret: number) {
    const before = value.slice(0, caret);
    const m = before.match(/(?:^|\s)([@#])([\w-]{0,30})$/);
    if (!m) {
      if (trigger.char) closeTrigger();
      return;
    }
    setTrigger({
      char: m[1] as "@" | "#",
      start: caret - m[2].length - 1,
      query: m[2].toLowerCase(),
    });
  }

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!trigger.char) return [];
    if (trigger.char === "@") {
      const colorFor = (m: GuildMember): string | undefined => {
        if (!guildRoles.length || !m.roles?.length) return undefined;
        const sorted = [...guildRoles]
          .filter((r) => m.roles.includes(r.id) && r.color !== 0)
          .sort((a, b) => b.position - a.position);
        if (!sorted.length) return undefined;
        return "#" + sorted[0].color.toString(16).padStart(6, "0");
      };

      const memberById = new Map<string, GuildMember>();
      members.forEach((m) => {
        if (m.user?.id) memberById.set(m.user.id, m);
      });
      remoteMembers.forEach((m) => {
        if (m.user?.id && !memberById.has(m.user.id)) {
          memberById.set(m.user.id, m);
        }
      });

      const stubsFromMessages: GuildMember[] = [];
      if (channelMessages) {
        const haveIds = new Set(memberById.keys());
        for (const msg of channelMessages) {
          const a = msg.author;
          if (!a?.id || haveIds.has(a.id)) continue;
          haveIds.add(a.id);
          stubsFromMessages.push({
            user: a,
            roles: [],
            joined_at: "",
            deaf: false,
            mute: false,
          } as GuildMember);
        }
      }
      stubsFromMessages.forEach((m) => {
        if (m.user?.id && !memberById.has(m.user.id)) {
          memberById.set(m.user.id, m);
        }
      });

      const matches = (m: GuildMember) => {
        const n = (m.nick ?? m.user?.global_name ?? m.user?.username ?? "").toLowerCase();
        return n.includes(trigger.query);
      };

      const seen = new Set<string>();
      const ordered: GuildMember[] = [];
      for (const id of recentAuthorIds) {
        const m = memberById.get(id);
        if (!m || !matches(m)) continue;
        seen.add(id);
        ordered.push(m);
      }
      for (const m of memberById.values()) {
        if (!m.user?.id || seen.has(m.user.id)) continue;
        if (!matches(m)) continue;
        seen.add(m.user.id);
        ordered.push(m);
      }

      return ordered.slice(0, 8).map((m) => ({
        type: "user" as const,
        id: m.user!.id,
        label: m.nick ?? m.user?.global_name ?? m.user?.username ?? m.user!.id,
        sub: `@${m.user?.username ?? ""}`,
        insert: `<@${m.user!.id}>`,
        avatar: avatarUrl(m.user!.id, m.user!.avatar),
        color: colorFor(m),
      }));
    }
    return channels
      .filter(
        (c) =>
          c.type !== CHANNEL_TYPE.GUILD_CATEGORY &&
          c.name?.toLowerCase().includes(trigger.query),
      )
      .slice(0, 8)
      .map((c) => ({
        type: "channel" as const,
        id: c.id,
        label: c.name ?? c.id,
        insert: `<#${c.id}>`,
      }));
  }, [trigger, members, remoteMembers, channels, guildRoles, channelMessages, recentAuthorIds]);

  useEffect(() => {
    if (trigger.char !== "@") return;
    let alive = true;
    const handle = window.setTimeout(async () => {
      try {
        let fetched: GuildMember[] = [];
        if (trigger.query) {
          const r = await searchGuildMembers(serverId, trigger.query, 8);
          if (Array.isArray(r)) fetched = r;
        } else if (members.length < 25) {
          const r = await getGuildMembers(serverId, 25);
          if (Array.isArray(r)) fetched = r;
        }
        if (!alive) return;
        if (fetched.length) {
          setRemoteMembers(fetched);
          fetched.forEach((m: GuildMember) => {
            if (m?.user?.id) upsertMember(serverId, m);
          });
        }
      } catch {}
    }, 180);
    return () => {
      alive = false;
      window.clearTimeout(handle);
    };
  }, [trigger.char, trigger.query, serverId, upsertMember, members.length]);

  function closeTrigger() {
    setTrigger({ char: null, start: 0, query: "" });
    setRemoteMembers([]);
  }

  const safeActiveSugg = Math.min(activeSugg, Math.max(0, suggestions.length - 1));

  function applySuggestion(s: Suggestion) {
    setText((prev) => {
      const before = prev.slice(0, trigger.start);
      const after = prev.slice(taRef.current?.selectionStart ?? prev.length);
      return `${before}${s.insert} ${after}`;
    });
    closeTrigger();
  }

  async function send() {
    if (!canSend) {
      toast.error("Bot lacks Send Messages permission");
      return;
    }
    if (!text.trim() && files.length === 0) return;
    const sendPromise = async () => {
      let serialized:
        | { name: string; type: string; data: ArrayBuffer }[]
        | undefined;
      if (files.length) {
        serialized = await Promise.all(
          files.map(async (f) => ({
            name: f.file.name,
            type: f.file.type,
            data: await f.file.arrayBuffer(),
          })),
        );
      }
      const res = await sendMessage(
        channelId,
        tts,
        text || undefined,
        serialized,
        undefined,
        reply?.id,
      );
      if (!res?.id) throw new Error(res?.message ?? "Send failed");
      setText("");
      setFiles([]);
      onClearReply?.();
    };
    toast.promise(sendPromise(), {
      loading: "Sending",
      success: "Sent",
      error: (e) => `Error: ${e.message}`,
    });
  }

  async function sendSticker(stickerId: string) {
    const p = async () => {
      const res = await sendMessage(channelId, false, undefined, undefined, stickerId);
      if (!res?.id) throw new Error(res?.message ?? "Send failed");
      setStickerOpen(false);
    };
    toast.promise(p(), {
      loading: "Sending sticker",
      success: "Sticker sent",
      error: (e) => `Error: ${e.message}`,
    });
  }

  function insertAtCaret(token: string) {
    const ta = taRef.current;
    if (!ta) {
      setText((t) => t + token);
      return;
    }
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const next = text.slice(0, start) + token + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  const placeholder = useMemo(() => {
    if (!canSend) return "Bot can't send messages here";
    return channelName ? `Message #${channelName}` : "Type something…";
  }, [canSend, channelName]);

  return (
    <div className="border rounded-xl bg-background relative">
      {trigger.char && (
        <div className="absolute bottom-full mb-2 left-0 right-0 mx-3 border bg-popover rounded-md shadow-lg z-30 overflow-hidden">
          <div className="px-3 py-1 border-b text-[10px] uppercase tracking-[0.18em] font-mono text-muted-foreground flex items-center justify-between">
            <span>{trigger.char === "@" ? "Members matching" : "Channels matching"}</span>
            <span className="text-foreground/60">
              {trigger.query ? `"${trigger.query}"` : "any"}
            </span>
          </div>
          {suggestions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground italic">
              {trigger.char === "@"
                ? trigger.query
                  ? "No members found. Bot may need GUILD_MEMBERS intent."
                  : "Type a name to search for members."
                : "No channels match."}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
            {suggestions.map((s, i) => {
              const active = i === safeActiveSugg;
              return (
                <button
                  key={`${s.type}-${s.id}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applySuggestion(s);
                  }}
                  onMouseEnter={() => setActiveSugg(i)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors",
                    active
                      ? "bg-[oklch(0.7686_0.1647_70.08/0.15)] text-foreground"
                      : "hover:bg-muted/40",
                  )}
                >
                  {s.type === "user" ? (
                    <DiscordAvatar src={s.avatar ?? "/discord.svg"} alt={s.label} size={20} />
                  ) : (
                    <Hash className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <span
                    className="font-medium truncate"
                    style={s.color ? { color: s.color } : undefined}
                  >
                    {s.label}
                  </span>
                  {s.sub && (
                    <span className="text-xs text-muted-foreground truncate">{s.sub}</span>
                  )}
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground/70 shrink-0">
                    {s.id.slice(-6)}
                  </span>
                </button>
              );
            })}
            </div>
          )}
          <div className="px-3 py-1 border-t text-[10px] font-mono text-muted-foreground flex items-center gap-3">
            <span><kbd className="font-mono">↑↓</kbd> nav</span>
            <span><kbd className="font-mono">↵</kbd> select</span>
            <span><kbd className="font-mono">esc</kbd> dismiss</span>
          </div>
        </div>
      )}
      {reply && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 text-xs">
          <CornerUpLeft className="size-3" />
          <span className="text-muted-foreground">Replying to</span>
          <span className="font-medium">{reply.author}</span>
          <span className="text-muted-foreground truncate flex-1">{reply.content}</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={onClearReply}
          >
            <X className="size-3" />
          </Button>
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 border-b">
          {files.map((f) => (
            <div
              key={f.id}
              className="relative group h-16 w-16 rounded-md border bg-muted/20"
            >
              {f.file.type.startsWith("image/") ? (
                <Image
                  src={f.url}
                  alt={f.file.name}
                  fill
                  unoptimized
                  className="rounded-md object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-1 text-center">
                  <Paperclip className="size-4 text-muted-foreground" />
                  <span className="text-[9px] truncate w-full">{f.file.name}</span>
                </div>
              )}
              <Button
                size="icon"
                variant="outline"
                className="absolute -top-1.5 -right-1.5 h-5 w-5"
                onClick={() => removeFile(f.id)}
              >
                <X className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Textarea
        ref={taRef}
        value={text}
        disabled={!canSend}
        onChange={(e) => {
          setText(e.target.value);
          notifyTyping();
          detectTrigger(e.target.value, e.target.selectionStart ?? 0);
        }}
        onKeyDown={(e) => {
          if (suggestions.length > 0) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveSugg((i) => (i + 1) % suggestions.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveSugg((i) => (i - 1 + suggestions.length) % suggestions.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              applySuggestion(suggestions[safeActiveSugg]);
              return;
            }
          }
          if (trigger.char && e.key === "Escape") {
            e.preventDefault();
            closeTrigger();
            return;
          }
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={placeholder}
        className="border-none shadow-none ring-0 focus-visible:ring-0 resize-none min-h-12 max-h-48 field-sizing-content"
      />
      <div className="flex items-center gap-1 px-2 pb-2 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="text-muted-foreground" disabled={!canSend}>
              <Plus className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onSelect={() => fileInput.current?.click()}
              disabled={!canAttach}
            >
              <Paperclip className="size-4 mr-2" /> Attach files
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={tts ? "secondary" : "ghost"}
              onClick={() => setTts((v) => !v)}
              disabled={!canSend}
              className={cn(tts ? "text-primary" : "text-muted-foreground")}
            >
              <Mic className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Text-to-speech</TooltipContent>
        </Tooltip>
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="text-muted-foreground" disabled={!canSend}>
              <SmilePlus className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-fit p-0" align="end">
            <EmojiPickerPro
              guildId={serverId}
              onSelect={(token) => {
                insertAtCaret(token);
                setEmojiOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        <Popover open={stickerOpen} onOpenChange={setStickerOpen}>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="text-muted-foreground" disabled={!canSend}>
              <Sticker className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-fit p-0" align="end">
            <StickerList serverId={serverId} onStickerSelectAction={sendSticker} />
          </PopoverContent>
        </Popover>
        <div className="flex-1" />
        {slowmode > 0 && (
          <span className="text-[10px] text-muted-foreground font-mono">{slowmode}s slow</span>
        )}
        {!canEmbed && canSend && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[10px] text-muted-foreground">no embeds</span>
            </TooltipTrigger>
            <TooltipContent>Bot lacks Embed Links permission</TooltipContent>
          </Tooltip>
        )}
        <Button
          size="icon"
          onClick={send}
          disabled={!canSend || (!text.trim() && files.length === 0)}
          className={cn(buttonVariants({ size: "icon" }), "shrink-0")}
        >
          <SendHorizontal className="size-4" />
        </Button>
      </div>
    </div>
  );
}
