"use client";

import { getStickers } from "@/api/data/actions";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useEffect, useState } from "react";
import { IdCard, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
} from "@/components/ui/context-menu";
import { CopyID } from "@/components/contextMenuHandellers";
import { toast } from "sonner";

interface StickerProps {
  id: string;
  name: string;
  format_type: number;
}

export default function StickerList({
  serverId,
  onStickerSelectAction,
}: {
  serverId: string;
  onStickerSelectAction?: (stickerId: string) => void;
}) {
  const [stickers, setStickers] = useState<StickerProps[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchStickers() {
      try {
        const data = await getStickers(serverId);
        if (mounted) {
          setStickers(data || []);
        }
      } catch (error) {
        console.error("Failed to fetch stickers:", error);
        if (mounted) {
          setStickers([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchStickers();

    return () => {
      mounted = false;
    };
  }, [serverId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (stickers.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No stickers available
      </div>
    );
  }

  const copy = (id: string) => {
    navigator.clipboard.writeText(id.toString());
    toast.success("Copied to clipboard");
  };

  return (
    <div className="grid grid-cols-4 md:grid-cols-5">
      {stickers.map((sticker: StickerProps) => (
        <ContextMenu key={sticker.id}>
          <Tooltip>
            <ContextMenuTrigger asChild>
              <TooltipTrigger asChild>
                <Button
                  variant={"ghost"}
                  className="p-1 h-auto"
                  onClick={() => onStickerSelectAction?.(sticker.id)}
                >
                  <Image
                    src={
                      sticker.format_type === 1 || sticker.format_type === 2
                        ? `https://cdn.discordapp.com/stickers/${sticker.id}.png?size=64`
                        : `https://cdn.discordapp.com/stickers/${sticker.id}?size=64`
                    }
                    alt={sticker.name}
                    width={64}
                    height={64}
                    className="rounded"
                    unoptimized
                  />
                </Button>
              </TooltipTrigger>
            </ContextMenuTrigger>
            <TooltipContent>{sticker.name}</TooltipContent>
          </Tooltip>
          <ContextMenuContent className="bg-sidebar font-mono tracking-tighter">
            <ContextMenuGroup>
              <ContextMenuItem onSelect={() => copy(sticker.name)}>
                <IdCard /> Copy Name
              </ContextMenuItem>
              <CopyID id={sticker.id} />
            </ContextMenuGroup>
          </ContextMenuContent>
        </ContextMenu>
      ))}
    </div>
  );
}
