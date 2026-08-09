"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { STATUS_COLOR } from "@/lib/discord/constants";

interface Props {
  src: string;
  alt: string;
  size?: number;
  className?: string;
  status?: keyof typeof STATUS_COLOR;
  fallback?: string;
}

export function DiscordAvatar({
  src,
  alt,
  size = 40,
  className,
  status,
  fallback,
}: Props) {
  return (
    <div
      className={cn(
        "relative shrink-0 rounded-full overflow-visible",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        unoptimized
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={(e) => {
          if (fallback) (e.currentTarget as HTMLImageElement).src = fallback;
        }}
      />
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-background",
            STATUS_COLOR[status] ?? STATUS_COLOR.offline,
          )}
          style={{
            width: Math.max(8, size / 4),
            height: Math.max(8, size / 4),
          }}
        />
      )}
    </div>
  );
}
