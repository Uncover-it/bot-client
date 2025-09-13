import {
  EllipsisVertical,
  Cog,
  LogOut,
  ChevronRight,
  ExternalLink,
  Hash,
  Megaphone,
  Mic,
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
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { CopyID, InviteLink } from "@/components/contextMenuHandellers";

interface ServerProps {
  id: number;
  name: string;
  icon: string | null;
  channels: ChannelProps[];
}

interface ChannelProps {
  id: number;
  name: string;
  type: number;
}

function Skeleton({count} : {count: number}) {
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
  return (
    <SidebarMenu>
      {data.map((server: ServerProps) => (
        <Collapsible key={server.id} asChild className="group/collapsible px-2">
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
                <ContextMenuSeparator />
                <CopyID id={server.id} />
                <ContextMenuItem>
                  <ExternalLink />
                  <Link
                    href={`https://id.uncoverit.org?id=${server.id}`}
                    target="_blank"
                  >
                    Lookup ID
                  </Link>
                </ContextMenuItem>
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
                              href="#"
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
                          <InviteLink id={channel.id}/>
                          <ContextMenuSeparator/>
                          <CopyID id={channel.id} />
                        </ContextMenuContent>
                      </ContextMenu>
                    </SidebarMenuSubItem>
                  ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      ))}
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
        <Suspense fallback={<Skeleton count={1}/>}>
          <Footer />
        </Suspense>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
