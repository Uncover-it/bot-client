"use client";

import { memo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { readableRoleColor } from "@/lib/discord/role-color";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import Link from "next/link";

interface Props {
  children: string;
  className?: string;
}

function MentionPill({
  href,
  children: c,
}: {
  href: string;
  children?: ReactNode;
}) {
  const theme = useResolvedTheme();
  const rest = href.slice(3);
  const slash = rest.indexOf("/");
  const kind = slash === -1 ? rest : rest.slice(0, slash);
  const idAndQ = slash === -1 ? "" : rest.slice(slash + 1);
  const qIdx = idAndQ.indexOf("?");
  const params = qIdx === -1 ? "" : idAndQ.slice(qIdx + 1);
  const rawColor = (() => {
    if (!params) return undefined;
    const usp = new URLSearchParams(params);
    const cc = usp.get("c");
    return cc || undefined;
  })();
  const color = readableRoleColor(rawColor, theme);
  const tone =
    kind === "self" || kind === "broadcast"
      ? "bg-[oklch(0.7686_0.1647_70.08/0.28)] text-[var(--mention-foreground)] ring-1 ring-[oklch(0.7686_0.1647_70.08/0.45)]"
      : kind === "role"
        ? "bg-[var(--mention)] ring-1 ring-[oklch(0.7686_0.1647_70.08/0.35)]"
        : kind === "channel"
          ? "bg-muted text-foreground hover:bg-muted/70"
          : "bg-[var(--mention)] text-[var(--mention-foreground)] ring-1 ring-[oklch(0.7686_0.1647_70.08/0.35)] hover:bg-[oklch(0.7686_0.1647_70.08/0.28)]";
  return (
    <span
      className={cn(
        "inline-block px-1 -mx-0.5 rounded-sm text-[0.95em] font-medium align-baseline transition-colors",
        tone,
      )}
      style={kind === "role" && color ? { color } : undefined}
    >
      {c}
    </span>
  );
}

export const Markdown = memo(function Markdown({ children, className }: Props) {
  return (
    <div
      className={cn(
        "prose-sm max-w-none break-words",
        "[&_p]:my-0 [&_p]:leading-relaxed",
        "[&_pre]:bg-muted [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto",
        "[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.85em] [&_code]:font-mono",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:my-1",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0",
        "[&_a]:text-sky-500 dark:[&_a]:text-sky-400 [&_a]:underline-offset-2 [&_a]:underline [&_a]:decoration-sky-500/30 dark:[&_a]:decoration-sky-400/30 [&_a:hover]:decoration-sky-500 dark:[&_a:hover]:decoration-sky-400 [&_a:hover]:text-sky-600 dark:[&_a:hover]:text-sky-300 [&_a]:transition-colors [&_a]:break-all",
        "[&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-2 [&_h1]:mb-1",
        "[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1",
        "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-1 [&_h3]:mb-1",
        "[&_table]:border [&_table]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:border-b [&_th]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:border-b [&_td]:border-border",
        "[&_hr]:my-2 [&_hr]:border-border",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => {
          if (url.startsWith("dc:")) return url;
          if (/^(https?:|mailto:|tel:|#|\/)/i.test(url)) return url;
          return "";
        }}
        components={{
          a: ({
            href,
            children: c,
          }: {
            href?: string;
            children?: ReactNode;
          }) => {
            if (href?.startsWith("dc:")) {
              return <MentionPill href={href}>{c}</MentionPill>;
            }
            return (
              <Link
                href={href ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                {c}
              </Link>
            );
          },
          img: ({ src, alt }: { src?: string | Blob; alt?: string }) => {
            if (typeof src !== "string") return null;
            if (src.startsWith("dc:emoji/")) {
              const rest = src.slice("dc:emoji/".length);
              const [id, q = ""] = rest.split("?");
              const animated = new URLSearchParams(q).get("a") === "1";
              const ext = animated ? "gif" : "png";
              return (
                <img
                  src={`https://cdn.discordapp.com/emojis/${id}.${ext}`}
                  alt={alt ?? ""}
                  className="inline-block size-[22px] align-text-bottom"
                  draggable={false}
                />
              );
            }
            return null;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
