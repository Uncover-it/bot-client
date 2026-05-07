"use client";

import { memo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Props {
  children: string;
  className?: string;
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
        "[&_a]:text-blue-500 [&_a]:underline-offset-2 hover:[&_a]:underline",
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
        components={{
          a: ({ href, children: c }: { href?: string; children?: ReactNode }) => (
            <Link href={href ?? "#"} target="_blank" rel="noopener noreferrer">
              {c}
            </Link>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
