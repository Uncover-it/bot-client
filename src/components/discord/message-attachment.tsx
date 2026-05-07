"use client";

import Image from "next/image";
import Link from "next/link";
import { Download, FileIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { CopyID } from "@/components/contextMenuHandellers";
import type { Attachment } from "@/lib/discord/types";
import { toast } from "sonner";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

export function MessageAttachment({ a }: { a: Attachment }) {
  const isImage = a.content_type?.startsWith("image/");
  const isVideo = a.content_type?.startsWith("video/");
  const isAudio = a.content_type?.startsWith("audio/");

  if (isImage) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Link
            href={a.proxy_url}
            target="_blank"
            className="inline-block max-w-full"
          >
            <Image
              src={a.proxy_url}
              alt={a.filename}
              width={a.width ?? 400}
              height={a.height ?? 300}
              unoptimized
              className="rounded-md max-h-[400px] max-w-full w-auto h-auto object-contain"
            />
          </Link>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onSelect={() => {
              navigator.clipboard.writeText(a.proxy_url);
              toast.success("Link copied");
            }}
          >
            Copy link
          </ContextMenuItem>
          <ContextMenuSeparator />
          <CopyID id={a.id} />
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  if (isVideo) {
    return (
      <video
        src={a.proxy_url}
        controls
        className="rounded-md w-full max-w-md max-h-[400px]"
      />
    );
  }

  if (isAudio) {
    return <audio src={a.proxy_url} controls className="w-full max-w-md" />;
  }

  return (
    <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-md w-full max-w-md">
      <FileIcon className="size-8 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{a.filename}</div>
        <div className="text-xs text-muted-foreground">{formatBytes(a.size)}</div>
      </div>
      <Link
        href={a.proxy_url}
        target="_blank"
        className={cn(buttonVariants({ size: "icon", variant: "ghost" }), "shrink-0")}
      >
        <Download className="size-4" />
      </Link>
    </div>
  );
}
