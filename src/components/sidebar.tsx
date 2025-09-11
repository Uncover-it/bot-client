import { EllipsisVertical, Cog, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarMenu,
  SidebarMenuButton,
  SidebarFooter,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { getInfo } from "@/api/data/actions";
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
import { logout } from "@/api/data/actions";

function Skeleton() {
  return (
    <SidebarMenu>
      {Array.from({ length: 5 }).map((_, index) => (
        <SidebarMenuItem key={index}>
          <SidebarMenuSkeleton />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

async function Footer() {
  const data = await getInfo();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
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
              />
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
            side={"right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Cog />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" asChild>
              <form action={logout}>
                <button className="flex w-full items-center gap-2">
                  <LogOut className="text-destructive"/>
                  Log out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function AppSidebar() {
  return (
    <Sidebar>
      <Suspense fallback={<Skeleton />}>
        <SidebarFooter>
          <Footer />
        </SidebarFooter>
      </Suspense>
    </Sidebar>
  );
}
