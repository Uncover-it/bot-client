"use client";

import Image from "next/image";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/utils";
import type { Embed } from "@/lib/discord/types";

export function MessageEmbed({ embed }: { embed: Embed }) {
  const color = embed.color ? "#" + embed.color.toString(16).padStart(6, "0") : undefined;
  return (
    <div
      className="rounded-md overflow-hidden text-foreground w-full max-w-lg min-w-0"
      style={{ borderLeft: color ? `4px solid ${color}` : undefined }}
    >
      <div className="bg-muted/40 p-3 space-y-2 min-w-0">
        {embed.author && (
          <div className="flex items-center gap-2 min-w-0">
            {embed.author.proxy_icon_url && (
              <Image
                src={embed.author.proxy_icon_url}
                alt=""
                className="rounded-full shrink-0"
                width={20}
                height={20}
                unoptimized
              />
            )}
            <span className="text-sm font-medium truncate">{embed.author.name}</span>
          </div>
        )}
        {embed.title && (
          <div className="font-semibold text-sm break-words">
            {embed.url ? (
              <a href={embed.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                {embed.title}
              </a>
            ) : (
              embed.title
            )}
          </div>
        )}
        {embed.description && (
          <div className="min-w-0 break-words">
            <Markdown className="text-sm">{embed.description}</Markdown>
          </div>
        )}
        {embed.fields && embed.fields.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
            {embed.fields.map((f, i) => (
              <div key={i} className={cn("min-w-0 break-words", f.inline ? "" : "sm:col-span-2")}>
                <div className="text-xs font-semibold break-words">{f.name}</div>
                <Markdown className="text-xs">{f.value}</Markdown>
              </div>
            ))}
          </div>
        )}
        {embed.image && (
          <Image
            src={embed.image.proxy_url ?? embed.image.url}
            alt=""
            width={embed.image.width ?? 400}
            height={embed.image.height ?? 300}
            unoptimized
            className="rounded-md max-h-[400px] max-w-full w-auto h-auto object-contain"
          />
        )}
        {embed.thumbnail && (
          <Image
            src={embed.thumbnail.proxy_url ?? embed.thumbnail.url}
            alt=""
            width={embed.thumbnail.width ?? 80}
            height={embed.thumbnail.height ?? 80}
            unoptimized
            className="rounded-md max-w-full h-auto"
          />
        )}
        {embed.footer && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            {embed.footer.proxy_icon_url && (
              <Image
                src={embed.footer.proxy_icon_url}
                alt=""
                className="rounded-full"
                width={16}
                height={16}
                unoptimized
              />
            )}
            <span>{embed.footer.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
