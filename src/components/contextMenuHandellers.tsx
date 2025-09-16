"use client";

import { ContextMenuItem } from "@/components/ui/context-menu";
import { Copy, UserRoundPlus, UserRound, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { getInviteCode } from "@/api/data/actions";

export function CopyID({ id }: { id: number | string }) {
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

export function CopyUsername({ username }: { username: string }) {
  const copy = () => {
    navigator.clipboard.writeText(username);
    toast.success("Copied to clipboard");
  };
  return (
    <ContextMenuItem onSelect={() => copy()}>
      <UserRound />
      Copy Username
    </ContextMenuItem>
  );
}

export function CopyMessage({ message }: { message: string }) {
  const copy = () => {
    navigator.clipboard.writeText(message);
    toast.success("Copied to clipboard");
  };
  return (
    <ContextMenuItem onSelect={() => copy()}>
      <MessageCircle />
      Copy Message
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
        return `Invite Link copied to clipboard`;
      },
      error: (error) => {
        return `Error: ${error.message}`;
      },
    });
  }
  return (
    <ContextMenuItem onSelect={() => handleInv()}>
      <UserRoundPlus />
      Invite Link
    </ContextMenuItem>
  );
}
