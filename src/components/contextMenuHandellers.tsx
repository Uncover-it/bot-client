"use client";

import { ContextMenuItem } from "@/components/ui/context-menu";
import { Copy, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { getInviteCode } from "@/api/data/actions";

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

export function InviteLink({ id }: { id: number | undefined }) {
  function handleInv() {
    const invPormise = async () => {
      const link = await getInviteCode(id);
      if (id !== undefined) {
        navigator.clipboard.writeText(`discord.gg/${link}`);
      }
    };

    toast.promise(invPormise(), {
      loading: "Fetching Invite link",
      success: () => {
        return `Invite Link Copied to Clipboard`;
      },
      error: (error) => {
        return `Error: ${error.message}`;
      },})
  }
  return (
    <ContextMenuItem onSelect={() => handleInv()}>
      <UserRoundPlus />
      Invite Link
    </ContextMenuItem>
  );
}
