"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Cog,
  EllipsisVertical,
  ExternalLink,
  FileImage,
  Hash,
  IdCard,
  LogOut,
  Megaphone,
  MessageSquareText,
  Mic,
  Radio,
  Settings,
  Webhook,
} from "lucide-react";
import {
  Sidebar,
  SidebarMenu,
  SidebarMenuButton,
  SidebarFooter,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarHeader,
  SidebarContent,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import Image from "next/image";
import Link from "next/link";
import Logo from "../../public/logo.png";
import { ThemeToggle } from "@/components/theme-toggle";
import { BotSettings } from "@/components/settings";
import { CopyID, InviteLink } from "@/components/contextMenuHandellers";
import { logout, getServers } from "@/api/data/actions";
import { useRealtimeStore } from "@/lib/store";
import { CHANNEL_TYPE } from "@/lib/discord/constants";
import { can, listPermissions } from "@/lib/discord/permissions";
import { useGuildPermissions } from "@/hooks/use-permissions";
import { ChannelSettingsDialog } from "@/components/discord/channel-settings-dialog";
import { WebhooksDialog } from "@/components/discord/webhooks-dialog";
import { avatarUrl, guildIconUrl } from "@/lib/discord/cdn";
import type { Channel, Guild } from "@/lib/discord/types";

export function AppSidebar() {
  const guildsMap = useRealtimeStore((s) => s.guilds);
  const user = useRealtimeStore((s) => s.user);
  const setGuilds = useRealtimeStore((s) => s.setGuilds);
  const guilds = useMemo(() => Array.from(guildsMap.values()), [guildsMap]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getServers();
        if (alive && Array.isArray(data)) setGuilds(data);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [setGuilds]);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex w-full items-center gap-2 overflow-hidden rounded-md p-2">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                <Image src={Logo} alt="logo" style={{ width: 25, height: 25 }} />
              </div>
              <div className="grid text-left text-sm leading-tight">
                <span className="truncate font-medium">Discord Bot Client</span>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <ThemeToggle />
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {guilds.length === 0 ? (
          <SidebarMenu>
            {Array.from({ length: 5 }).map((_, i) => (
              <SidebarMenuItem key={i}>
                <SidebarMenuSkeleton />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        ) : (
          <SidebarMenu>
            {guilds.map((g) => (
              <ServerItem key={g.id} guild={g} />
            ))}
          </SidebarMenu>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <Dialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                    <Image
                      src={user ? avatarUrl(user.id, user.avatar) : "/discord.svg"}
                      alt={user?.username ?? "bot"}
                      width={32}
                      height={32}
                      unoptimized
                      className="rounded-lg"
                    />
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user?.username ?? "…"}</span>
                      <span className="text-muted-foreground truncate text-xs">{user?.id}</span>
                    </div>
                    <EllipsisVertical className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-(--radix-dropdown-menu-trigger-width) min-w-56 max-w-[calc(100vw-1rem)] rounded-lg"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuGroup>
                    <DialogTrigger asChild>
                      <DropdownMenuItem>
                        <Cog />
                        Settings
                      </DropdownMenuItem>
                    </DialogTrigger>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" asChild>
                    <form action={logout}>
                      <button className="flex w-full items-center gap-2">
                        <LogOut className="text-destructive" />
                        Log out
                      </button>
                    </form>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DialogContent>
                <BotSettings />
              </DialogContent>
            </Dialog>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function ServerItem({ guild }: { guild: Guild }) {
  const icon = useMemo(() => guildIconUrl(guild.id, guild.icon), [guild.id, guild.icon]);
  const enabledPerms = useMemo(
    () => (guild.permissions ? listPermissions(guild.permissions) : []),
    [guild.permissions],
  );
  const { categories, uncategorized } = useMemo(() => {
    const all = guild.channels ?? [];
    const byPosition = (a: Channel, b: Channel) =>
      (a.position ?? 0) - (b.position ?? 0);
    const cats = all
      .filter((c) => c.type === CHANNEL_TYPE.GUILD_CATEGORY)
      .slice()
      .sort(byPosition);
    const others = all.filter((c) => c.type !== CHANNEL_TYPE.GUILD_CATEGORY);
    const grouped = cats.map((cat) => ({
      cat,
      children: others
        .filter((c) => c.parent_id === cat.id)
        .slice()
        .sort(byPosition),
    }));
    const uncat = others
      .filter((c) => !c.parent_id)
      .slice()
      .sort(byPosition);
    return { categories: grouped, uncategorized: uncat };
  }, [guild.channels]);

  const firstInvitable = (guild.channels ?? []).find(
    (c) =>
      c.type === CHANNEL_TYPE.GUILD_TEXT ||
      c.type === CHANNEL_TYPE.GUILD_VOICE ||
      c.type === CHANNEL_TYPE.GUILD_ANNOUNCEMENT,
  );

  return (
    <Collapsible asChild className="group/collapsible px-2">
      <SidebarMenuItem>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip={guild.name} className="h-12">
                {icon ? (
                  <Image
                    src={icon}
                    alt={guild.name}
                    width={32}
                    height={32}
                    unoptimized
                    className="rounded-lg"
                    style={{ width: 32, height: 32 }}
                  />
                ) : (
                  <div className="size-8 rounded-xl text-center justify-center text-lg items-center grid bg-border font-medium font-mono">
                    {guild.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-md ml-1 flex font-medium truncate">{guild.name}</span>
                <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
          </ContextMenuTrigger>
          <ContextMenuContent className="bg-sidebar font-mono tracking-tighter">
            <ContextMenuGroup>
              <Link href={`/dashboard/servers/${guild.id}/settings`}>
                <ContextMenuItem>
                  <Settings />
                  Server settings
                </ContextMenuItem>
              </Link>
              <InviteLink id={firstInvitable?.id} />
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <IdCard />
                  Permissions
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="bg-sidebar">
                  {enabledPerms.length ? (
                    enabledPerms.map((p) => <ContextMenuItem key={p}>{p}</ContextMenuItem>)
                  ) : (
                    <ContextMenuItem disabled>None</ContextMenuItem>
                  )}
                </ContextMenuSubContent>
              </ContextMenuSub>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <CopyID id={guild.id} />
              <Link href={`https://id.uncoverit.org?id=${guild.id}`} target="_blank">
                <ContextMenuItem>
                  <ExternalLink />
                  Lookup ID
                </ContextMenuItem>
              </Link>
            </ContextMenuGroup>
          </ContextMenuContent>
        </ContextMenu>
        <CollapsibleContent>
          <SidebarMenuSub>
            {uncategorized.map((c) => (
              <ChannelLink key={c.id} guildId={guild.id} channel={c} />
            ))}
            {categories.map(({ cat, children }) => (
              <CategoryGroup
                key={cat.id}
                guildId={guild.id}
                category={cat}
                channels={children}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function CategoryGroup({
  guildId,
  category,
  channels,
}: {
  guildId: string;
  category: Channel;
  channels: Channel[];
}) {
  return (
    <Collapsible defaultOpen className="group/cat">
      <CollapsibleTrigger className="flex items-center gap-1 w-full px-2 py-1 text-[10px] uppercase font-semibold tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
        <ChevronRight className="size-3 transition-transform group-data-[state=open]/cat:rotate-90" />
        <span className="truncate">{category.name}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {channels.map((c) => (
          <ChannelLink key={c.id} guildId={guildId} channel={c} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ChannelLink({ guildId, channel }: { guildId: string; channel: Channel }) {
  const [editOpen, setEditOpen] = useState(false);
  const [webhooksOpen, setWebhooksOpen] = useState(false);
  const perms = useGuildPermissions(guildId);
  const canManage = can(perms, "Manage Channels");
  const canWebhooks = can(perms, "Manage Webhooks");
  const { isMobile, setOpenMobile } = useSidebar();
  const supportsWebhooks =
    channel.type === CHANNEL_TYPE.GUILD_TEXT ||
    channel.type === CHANNEL_TYPE.GUILD_ANNOUNCEMENT ||
    channel.type === CHANNEL_TYPE.GUILD_FORUM ||
    channel.type === CHANNEL_TYPE.GUILD_MEDIA;
  const Icon =
    channel.type === CHANNEL_TYPE.GUILD_VOICE
      ? Mic
      : channel.type === CHANNEL_TYPE.GUILD_STAGE_VOICE
        ? Radio
        : channel.type === CHANNEL_TYPE.GUILD_ANNOUNCEMENT
          ? Megaphone
          : channel.type === CHANNEL_TYPE.GUILD_FORUM
            ? MessageSquareText
            : channel.type === CHANNEL_TYPE.GUILD_MEDIA
              ? FileImage
              : Hash;
  return (
    <SidebarMenuSubItem>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <SidebarMenuSubButton asChild>
            <Link
              href={`/dashboard/servers/${guildId}/channels/${channel.id}`}
              className="font-mono min-h-8 flex items-center gap-2 min-w-0"
              title={channel.name}
              onClick={() => {
                if (isMobile) setOpenMobile(false);
              }}
            >
              <Icon size={16} className="text-muted-foreground shrink-0" />
              <span className="truncate min-w-0 flex-1">{channel.name}</span>
            </Link>
          </SidebarMenuSubButton>
        </ContextMenuTrigger>
        <ContextMenuContent className="bg-sidebar font-mono tracking-tighter">
          {canManage && (
            <>
              <ContextMenuItem onSelect={() => setEditOpen(true)}>
                <Settings />
                Edit channel
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <InviteLink id={channel.id} />
          {supportsWebhooks && canWebhooks && (
            <ContextMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setWebhooksOpen(true);
              }}
            >
              <Webhook />
              Webhooks
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <CopyID id={channel.id} />
        </ContextMenuContent>
      </ContextMenu>
      {editOpen && (
        <ChannelSettingsDialog
          guildId={guildId}
          channel={channel}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
      {supportsWebhooks && (
        <WebhooksDialog
          channelId={channel.id}
          channelName={channel.name}
          open={webhooksOpen}
          onOpenChange={setWebhooksOpen}
        />
      )}
    </SidebarMenuSubItem>
  );
}
