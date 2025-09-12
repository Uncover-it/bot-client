"use client";

import { ContextMenuItem } from "@/components/ui/context-menu";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export function CopyID({ id }: { id: number }) {
  const copy = () => {
    navigator.clipboard.writeText(id.toString());
    toast.success("Copied to clipboard");
  };
  return (
    <ContextMenuItem onSelect={() => copy()}>
      <Copy />
      Copy ID
    </ContextMenuItem>
  );
}
