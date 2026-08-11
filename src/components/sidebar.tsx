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
  TimerOff,
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
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
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
import { usePathname } from "next/navigation";
import Logo from "../../public/logo.png";
import { ThemeToggle } from "@/components/theme-toggle";
import { BotSettings } from "@/components/settings";
import { CopyID, InviteLink } from "@/components/contextMenuHandellers";
import { logout, getServers } from "@/api/data/actions";
import { useRealtimeStore } from "@/lib/store";
import { CHANNEL_TYPE } from "@/lib/discord/constants";
import { can, listPermissions } from "@/lib/discord/permissions";
import { useGuildPermissions } from "@/hooks/use-permissions";
import { formatCountdown, useSelfTimeout } from "@/hooks/use-self-timeout";
import { ChannelSettingsDialog } from "@/components/discord/channel-settings-dialog";
import { DirectMessagesSection } from "@/components/discord/dm-sidebar-section";
import { UnreadBadge } from "@/components/discord/unread-badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { avatarUrl, guildIconUrl } from "@/lib/discord/cdn";
import { cn } from "@/lib/utils";
import type { Channel, Guild } from "@/lib/discord/types";

const SKELETON_ROWS = ["s1", "s2", "s3", "s4", "s5"];

/** Matches a guild when its own name matches, or any of its channels do. */
function matchesFilter(guild: Guild, needle: string): boolean {
  if (!needle) return true;
  if (guild.name.toLowerCase().includes(needle)) return true;
  return (guild.channels ?? []).some((c) =>
    c.name?.toLowerCase().includes(needle),
  );
}

/**
 * Clears the cookie, drops the store, then leaves with a full page load. A
 * client-side navigation would keep this bundle alive, and the next bot would
 * log in on top of the previous one's guilds, members and messages.
 */
async function handleLogout() {
  try {
    await logout();
  } catch {}
  useRealtimeStore.getState().reset();
  window.location.replace("/");
}

export function AppSidebar() {
  const guildsMap = useRealtimeStore((s) => s.guilds);
  const user = useRealtimeStore((s) => s.user);
  const upsertGuild = useRealtimeStore((s) => s.upsertGuild);
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const guilds = useMemo(() => Array.from(guildsMap.values()), [guildsMap]);
  const visible = useMemo(
    () => guilds.filter((g) => matchesFilter(g, needle)),
    [guilds, needle],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getServers();
        if (!alive || !Array.isArray(data)) return;
        data.forEach((g) => {
          upsertGuild(g);
        });
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [upsertGuild]);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex w-full items-center gap-2 overflow-hidden rounded-md p-2">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                <Image
                  src={Logo}
                  alt="logo"
                  style={{ width: 25, height: 25 }}
                />
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

      <SidebarContent className="pt-1">
        <div className="px-4 pb-1">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter servers and channels"
            aria-label="Filter servers and channels"
            className="h-9 md:h-8 text-base md:text-xs"
          />
        </div>
        <SidebarMenu>
          <DirectMessagesSection />
        </SidebarMenu>
        {guilds.length === 0 ? (
          <SidebarMenu>
            {SKELETON_ROWS.map((id) => (
              <SidebarMenuItem key={id}>
                <SidebarMenuSkeleton />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        ) : (
          <SidebarMenu>
            {visible.length === 0 && (
              <p className="px-4 py-2 text-xs text-muted-foreground">
                Nothing matches “{filter}”.
              </p>
            )}
            {visible.map((g) => (
              <ServerItem key={g.id} guild={g} channelFilter={needle} />
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
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent"
                  >
                    <Image
                      src={
                        user ? avatarUrl(user.id, user.avatar) : "/discord.svg"
                      }
                      alt={user?.username ?? "bot"}
                      width={32}
                      height={32}
                      unoptimized
                      className="rounded-lg"
                    />
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">
                        {user?.username ?? "…"}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {user?.id}
                      </span>
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
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      void handleLogout();
                    }}
                  >
                    <LogOut className="text-destructive" />
                    Log out
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

function ServerItem({
  guild,
  channelFilter,
}: {
  guild: Guild;
  channelFilter: string;
}) {
  const icon = useMemo(
    () => guildIconUrl(guild.id, guild.icon),
    [guild.id, guild.icon],
  );
  // Resolved once per guild rather than once per channel row.
  const perms = useGuildPermissions(guild.id);
  const canManageChannels = can(perms, "Manage Channels");
  const timeout = useSelfTimeout(guild.id);
  // Filtering forces the guild open so matching channels are actually
  // visible, then hands control back once the box is cleared.
  const [open, setOpen] = useState(false);
  const enabledPerms = useMemo(
    () => (guild.permissions ? listPermissions(guild.permissions) : []),
    [guild.permissions],
  );
  const { categories, uncategorized } = useMemo(() => {
    const all = guild.channels ?? [];
    const isVoice = (t: number) =>
      t === CHANNEL_TYPE.GUILD_VOICE || t === CHANNEL_TYPE.GUILD_STAGE_VOICE;
    const byPosition = (a: Channel, b: Channel) =>
      (a.position ?? 0) - (b.position ?? 0);
    const byChannelOrder = (a: Channel, b: Channel) => {
      const av = isVoice(a.type);
      const bv = isVoice(b.type);
      if (av !== bv) return av ? 1 : -1;
      return (a.position ?? 0) - (b.position ?? 0);
    };
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
        .sort(byChannelOrder),
    }));
    const uncat = others
      .filter((c) => !c.parent_id)
      .slice()
      .sort(byChannelOrder);
    if (!channelFilter || guild.name.toLowerCase().includes(channelFilter)) {
      return { categories: grouped, uncategorized: uncat };
    }
    // The guild matched only through its channels, so show just those.
    const keep = (c: Channel) => c.name?.toLowerCase().includes(channelFilter);
    return {
      categories: grouped
        .map((g) => ({ ...g, children: g.children.filter(keep) }))
        .filter((g) => g.children.length > 0),
      uncategorized: uncat.filter(keep),
    };
  }, [guild.channels, guild.name, channelFilter]);

  const firstInvitable = (guild.channels ?? []).find(
    (c) =>
      c.type === CHANNEL_TYPE.GUILD_TEXT ||
      c.type === CHANNEL_TYPE.GUILD_VOICE ||
      c.type === CHANNEL_TYPE.GUILD_ANNOUNCEMENT,
  );

  return (
    <Collapsible
      asChild
      className="group/collapsible px-2"
      open={channelFilter ? true : open}
      onOpenChange={setOpen}
    >
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
                    className={cn(
                      "rounded-lg",
                      timeout.active && "opacity-60 grayscale",
                    )}
                    style={{ width: 32, height: 32 }}
                  />
                ) : (
                  <div className="size-8 rounded-xl text-center justify-center text-lg items-center grid bg-border font-medium font-mono">
                    {guild.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-md ml-1 flex font-medium truncate">
                  {guild.name}
                </span>
                {timeout.active && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="shrink-0 inline-flex items-center gap-1 px-1 py-0.5 rounded bg-destructive/15 text-destructive text-[9px] font-mono font-semibold tabular-nums">
                        <TimerOff className="size-2.5" />
                        {formatCountdown(timeout.msLeft)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      The bot is timed out here and cannot send messages
                    </TooltipContent>
                  </Tooltip>
                )}
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
                    enabledPerms.map((p) => (
                      <ContextMenuItem key={p}>{p}</ContextMenuItem>
                    ))
                  ) : (
                    <ContextMenuItem disabled>None</ContextMenuItem>
                  )}
                </ContextMenuSubContent>
              </ContextMenuSub>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <CopyID id={guild.id} />
              <Link
                href={`https://id.uncoverit.org?id=${guild.id}`}
                target="_blank"
              >
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
              <ChannelLink
                key={c.id}
                guildId={guild.id}
                channel={c}
                canManage={canManageChannels}
              />
            ))}
            {categories.map(({ cat, children }) => (
              <CategoryGroup
                key={cat.id}
                guildId={guild.id}
                category={cat}
                channels={children}
                canManage={canManageChannels}
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
  canManage,
}: {
  guildId: string;
  category: Channel;
  channels: Channel[];
  canManage: boolean;
}) {
  return (
    <Collapsible defaultOpen className="group/cat">
      <CollapsibleTrigger className="flex items-center gap-1 w-full px-2 py-1 text-[10px] uppercase font-semibold tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
        <ChevronRight className="size-3 transition-transform group-data-[state=open]/cat:rotate-90" />
        <span className="truncate">{category.name}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {channels.map((c) => (
          <ChannelLink
            key={c.id}
            guildId={guildId}
            channel={c}
            canManage={canManage}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ChannelLink({
  guildId,
  channel,
  canManage,
}: {
  guildId: string;
  channel: Channel;
  canManage: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const href = `/dashboard/servers/${guildId}/channels/${channel.id}`;
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
          <SidebarMenuSubButton asChild isActive={pathname === href}>
            <Link
              href={href}
              className="font-mono min-h-8 flex items-center gap-2 min-w-0"
              title={channel.name}
              onClick={() => {
                if (isMobile) setOpenMobile(false);
              }}
            >
              <Icon size={16} className="text-muted-foreground shrink-0" />
              <span className="truncate min-w-0 flex-1">{channel.name}</span>
              <UnreadBadge channelId={channel.id} />
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
    </SidebarMenuSubItem>
  );
}
