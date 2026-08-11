"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, MessagesSquare, Plus, Trash2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Spinner from "@/components/ui/spinner";
import {
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { DiscordAvatar } from "@/components/ui/discord-avatar";
import { CopyID } from "@/components/contextMenuHandellers";
import { UnreadBadge } from "@/components/discord/unread-badge";
import { useRealtimeStore } from "@/lib/store";
import { useOpenDm } from "@/hooks/use-open-dm";
import { avatarUrl } from "@/lib/discord/cdn";
import { cn } from "@/lib/utils";

const ID_PATTERN = /^\d{15,25}$/;

export function DirectMessagesSection() {
  const dmsMap = useRealtimeStore((s) => s.dms);
  // Insertion order is oldest first; the most recently touched belongs on top.
  const dms = useMemo(() => Array.from(dmsMap.values()).reverse(), [dmsMap]);
  const [composeOpen, setComposeOpen] = useState(false);

  return (
    <SidebarMenuItem>
      <Collapsible defaultOpen className="group/dms px-2">
        <div className="flex items-center">
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip="Direct messages" className="h-12">
              <div className="size-8 rounded-xl grid place-items-center bg-border">
                <MessagesSquare className="size-4" />
              </div>
              <span className="text-md ml-1 flex font-medium truncate">
                Direct messages
              </span>
              <ChevronRight className="ml-auto transition-transform group-data-[state=open]/dms:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <SidebarMenuSub>
            {dms.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground leading-snug">
                No conversations yet. Start one below, or one appears here when
                somebody messages the bot.
              </p>
            )}
            {dms.map((dm) => (
              <DmLink key={dm.id} channelId={dm.id} />
            ))}
            <SidebarMenuSubItem>
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                className="flex items-center gap-2 w-full min-h-8 px-2 rounded-md text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
              >
                <Plus className="size-3.5 shrink-0" />
                New conversation
              </button>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
      <NewDmDialog open={composeOpen} onOpenChange={setComposeOpen} />
    </SidebarMenuItem>
  );
}

function DmLink({ channelId }: { channelId: string }) {
  const dm = useRealtimeStore((s) => s.dms.get(channelId));
  const removeDm = useRealtimeStore((s) => s.removeDm);
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const recipient = dm?.recipients?.[0];
  const name = recipient
    ? (recipient.global_name ?? recipient.username)
    : channelId;
  const active = pathname === `/dashboard/dms/${channelId}`;

  return (
    <SidebarMenuSubItem>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <SidebarMenuSubButton asChild isActive={active}>
            <Link
              href={`/dashboard/dms/${channelId}`}
              className="min-h-8 flex items-center gap-2 min-w-0"
              title={name}
              onClick={() => {
                if (isMobile) setOpenMobile(false);
              }}
            >
              <DiscordAvatar
                src={
                  recipient
                    ? avatarUrl(recipient.id, recipient.avatar)
                    : "/discord.svg"
                }
                alt={name}
                size={20}
              />
              <span className="truncate min-w-0 flex-1">{name}</span>
              <UnreadBadge channelId={channelId} />
            </Link>
          </SidebarMenuSubButton>
        </ContextMenuTrigger>
        <ContextMenuContent className="bg-sidebar font-mono tracking-tighter">
          {recipient && <CopyID id={recipient.id} />}
          <CopyID id={channelId} />
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onSelect={() => removeDm(channelId)}
          >
            <Trash2 />
            Remove from list
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </SidebarMenuSubItem>
  );
}

function NewDmDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const openDmWith = useOpenDm();
  const valid = ID_PATTERN.test(id.trim());

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    const channel = await openDmWith({ id: id.trim() });
    setBusy(false);
    if (channel) {
      setId("");
      onOpenChange(false);
      toast.success("Conversation opened");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a conversation</DialogTitle>
          <DialogDescription>
            Bots cannot browse people, so pick who to message by user ID. Turn
            on Developer Mode in Discord to copy one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Input
            value={id}
            autoFocus
            inputMode="numeric"
            placeholder="123456789012345678"
            onChange={(e) => setId(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            className={cn("font-mono", id && !valid && "border-destructive")}
          />
          {id && !valid && (
            <p className="text-xs text-destructive">
              A user ID is 15 to 25 digits.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || busy}>
            {busy && <Spinner size={14} className="mr-1.5" />}
            Open conversation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
