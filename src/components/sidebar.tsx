import {
  EllipsisVertical,
  Cog,
  LogOut,
  ChevronRight,
  ExternalLink,
  Hash,
  Megaphone,
  Mic,
  IdCard,
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
} from "@/components/ui/sidebar";
import { Suspense } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import { logout, getBotInfo, getServers } from "@/api/data/actions";
import Logo from "../../public/logo.png";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import Link from "next/link";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { BotSettings } from "@/components/settings";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { CopyID, InviteLink } from "@/components/contextMenuHandellers";

interface ServerProps {
  id: number;
  name: string;
  icon: string | null;
  permissions: string;
  channels: ChannelProps[];
}

interface ChannelProps {
  id: number;
  name: string;
  type: number;
}

function Skeleton({ count }: { count: number }) {
  return (
    <SidebarMenu>
      {Array.from({ length: count }).map((_, index) => (
        <SidebarMenuItem key={index}>
          <SidebarMenuSkeleton />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

async function Servers() {
  const data = await getServers();
  const permissionsMap: { [key: string]: bigint } = {
    Administrator: 1n << 3n,
    "Manage Server": 1n << 5n,
    "Manage Roles": 1n << 28n,
    "Manage Channels": 1n << 4n,
    "Ban Members": 1n << 2n,
    "Kick Members": 1n << 1n,
    "Manage Webhooks": 1n << 29n,
    "Manage Events": 1n << 33n,
    "Manage Threads": 1n << 34n,
    "Manage Guild Expressions": 1n << 30n,
    "Create Guild Expressions": 1n << 43n,
    "Create Events": 1n << 44n,
    "Manage Nicknames": 1n << 27n,
    "Change Nickname": 1n << 26n,
    "Moderate Members": 1n << 40n,
    "View Audit Log": 1n << 7n,
    "View Guild Insights": 1n << 19n,
    "View Creator Monetization Analytics": 1n << 41n,
    "View Channel": 1n << 10n,
    "Send Messages": 1n << 11n,
    "Send TTS Messages": 1n << 12n,
    "Manage Messages": 1n << 13n,
    "Embed Links": 1n << 14n,
    "Attach Files": 1n << 15n,
    "Read Message History": 1n << 16n,
    "Mention Everyone": 1n << 17n,
    "Send Messages in Threads": 1n << 38n,
    "Send Voice Messages": 1n << 46n,
    "Send Polls": 1n << 49n,
    "Pin Messages": 1n << 51n,
    "Add Reactions": 1n << 6n,
    "Use External Emojis": 1n << 18n,
    "Use External Stickers": 1n << 37n,
    "Use External Sounds": 1n << 45n,
    "Use External Apps": 1n << 50n,
    "Use Embedded Activities": 1n << 39n,
    "Use Application Commands": 1n << 31n,
    Connect: 1n << 20n,
    Speak: 1n << 21n,
    "Mute Members": 1n << 22n,
    "Deafen Members": 1n << 23n,
    "Move Members": 1n << 24n,
    "Use VAD": 1n << 25n,
    "Priority Speaker": 1n << 8n,
    Stream: 1n << 9n,
    "Request to Speak": 1n << 32n,
    "Create Instant Invite": 1n << 0n,
    "Create Public Threads": 1n << 35n,
    "Create Private Threads": 1n << 36n,
    "Use Soundboard": 1n << 42n,
  };

  return (
    <SidebarMenu>
      {data.map((server: ServerProps) => {
        const serverPermissions = BigInt(server.permissions);
        const enabledPermissions = Object.keys(permissionsMap).filter(
          (key) => (serverPermissions & permissionsMap[key]) !== 0n
        );

        return (
          <Collapsible
            key={server.id}
            asChild
            className="group/collapsible px-2"
          >
            <SidebarMenuItem>
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={server.name} className="h-12">
                      {server.icon ? (
                        <Image
                          src={`https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png`}
                          alt={server.name}
                          width={114}
                          height={114}
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "8px",
                          }}
                          unoptimized
                        />
                      ) : (
                        <div className="size-8 rounded-xl flex text-center justify-center text-lg items-center grid bg-border font-medium font-mono">
                          {server.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-md ml-1 flex font-medium">
                        {server.name}
                      </span>
                      <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                </ContextMenuTrigger>
                <ContextMenuContent className="bg-sidebar font-mono tracking-tighter">
                  <InviteLink
                    id={
                      server.channels.find(
                        (channel) =>
                          channel.type === 0 ||
                          channel.type === 2 ||
                          channel.type === 5
                      )?.id
                    }
                  />
                  <ContextMenuSub>
                    <ContextMenuSubTrigger>
                      <IdCard />
                      Permissions
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="bg-sidebar">
                      {enabledPermissions.length > 0 ? (
                        enabledPermissions.map((permission) => (
                          <ContextMenuItem key={permission}>
                            {permission}
                          </ContextMenuItem>
                        ))
                      ) : (
                        <ContextMenuItem disabled>
                          No permissions
                        </ContextMenuItem>
                      )}
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                  <ContextMenuSeparator />
                  <CopyID id={server.id} />
                  <Link
                    href={`https://id.uncoverit.org?id=${server.id}`}
                    target="_blank"
                  >
                    <ContextMenuItem>
                      <ExternalLink />
                      Lookup ID
                    </ContextMenuItem>
                  </Link>
                </ContextMenuContent>
              </ContextMenu>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {server.channels
                    ?.filter((channel) => channel.type !== 4)
                    .map((channel) => (
                      <SidebarMenuSubItem key={channel.id}>
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <SidebarMenuSubButton asChild>
                              <Link
                                href={`/dashboard/servers/${server.id}/channels/${channel.id}`}
                                className="font-mono text-clip min-h-8 "
                              >
                                <span className="text-muted-foreground">
                                  {channel.type === 2 ? (
                                    <Mic size={20} />
                                  ) : channel.type === 5 ? (
                                    <Megaphone size={20} />
                                  ) : (
                                    <Hash size={20} />
                                  )}
                                </span>
                                {channel.name}
                              </Link>
                            </SidebarMenuSubButton>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="bg-sidebar font-mono tracking-tighter">
                            <InviteLink id={channel.id} />
                            <ContextMenuSeparator />
                            <CopyID id={channel.id} />
                          </ContextMenuContent>
                        </ContextMenu>
                      </SidebarMenuSubItem>
                    ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        );
      })}
    </SidebarMenu>
  );
}

async function Footer() {
  const data = await getBotInfo();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                {data.logo !== "null" ? (
                  <Image
                    src={`https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}`}
                    alt={data.username}
                    width={128}
                    height={128}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                    }}
                    unoptimized
                  />
                ) : (
                  <Image
                    src="/discord.svg"
                    alt={data.username}
                    width={128}
                    height={128}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                    }}
                  />
                )}
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{data.username}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {data.id}
                  </span>
                </div>
                <EllipsisVertical className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
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
  );
}

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="border-b ">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex w-full items-center gap-2 overflow-hidden rounded-md pr-0 p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] [&>svg]:size-4 [&>svg]:shrink-0">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                <Image
                  src={Logo}
                  alt="logo"
                  style={{ width: "25px", height: "25px" }}
                />
              </div>
              <div className="grid flex text-left text-md leading-tight items-center justify-center">
                <span className="truncate font-medium">Discord Bot Client</span>
              </div>
              <ThemeToggle />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <Suspense fallback={<Skeleton count={5} />}>
          <Servers />
        </Suspense>
      </SidebarContent>

      <SidebarFooter className="border-t shadow-2xl inset-shadow-xs ">
        <Suspense fallback={<Skeleton count={1} />}>
          <Footer />
        </Suspense>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
