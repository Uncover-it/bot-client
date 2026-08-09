"use client";

import { useEffect, useState } from "react";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from "@/components/ui/emoji-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRealtimeStore } from "@/lib/store";
import { getGuildEmojis } from "@/api/data/actions";
import { emojiUrl } from "@/lib/discord/cdn";
import Image from "next/image";
import type { Emoji } from "@/lib/discord/types";

interface Props {
  guildId: string;
  onSelect: (token: string) => void;
}

type Tab = "guild" | "unicode";

export function EmojiPickerPro({ guildId, onSelect }: Props) {
  const guild = useRealtimeStore((s) => s.guilds.get(guildId));
  const setEmojis = useRealtimeStore((s) => s.setEmojis);
  const [tab, setTab] = useState<Tab>("guild");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    if (guild?.emojis) return;
    (async () => {
      try {
        const data: Emoji[] = await getGuildEmojis(guildId);
        if (alive && Array.isArray(data)) setEmojis(guildId, data);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [guildId, guild?.emojis, setEmojis]);

  const emojis = (guild?.emojis ?? []).filter((e) => e.id && e.name);
  const filtered = query
    ? emojis.filter((e) => e.name?.toLowerCase().includes(query.toLowerCase()))
    : emojis;

  return (
    <div className="w-[min(340px,calc(100vw-1rem))] flex flex-col bg-popover">
      <div className="flex border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTab("guild")}
          className={`flex-1 rounded-none ${tab === "guild" ? "bg-muted" : ""}`}
        >
          Server
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTab("unicode")}
          className={`flex-1 rounded-none ${tab === "unicode" ? "bg-muted" : ""}`}
        >
          Unicode
        </Button>
      </div>

      {tab === "guild" ? (
        <>
          <div className="p-2 border-b">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search server emoji"
              className="h-9 md:h-8 text-base md:text-xs"
            />
          </div>
          {emojis.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No server emojis. Bot may need View Guild Expressions.
            </div>
          ) : (
            <div className="grid grid-cols-8 gap-0.5 p-2 max-h-[280px] overflow-y-auto">
              {filtered.map((e) => (
                <button
                  type="button"
                  key={e.id!}
                  onClick={() =>
                    onSelect(`<${e.animated ? "a" : ""}:${e.name}:${e.id}>`)
                  }
                  title={`:${e.name}:`}
                  className="size-8 grid place-items-center rounded hover:bg-muted transition-colors"
                >
                  <Image
                    src={emojiUrl(e.id!, e.animated)}
                    alt={e.name ?? ""}
                    width={24}
                    height={24}
                    unoptimized
                  />
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <EmojiPicker
          className="h-[340px] flex flex-col"
          onEmojiSelect={({ emoji }) => onSelect(emoji)}
        >
          <EmojiPickerSearch className="z-10 mx-2 mt-2 rounded-md bg-muted px-2.5 py-2 text-sm" />
          <EmojiPickerContent />
          <EmojiPickerFooter />
        </EmojiPicker>
      )}
    </div>
  );
}
