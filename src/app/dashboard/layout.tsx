import { Suspense } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { GatewayProvider } from "@/components/providers/gateway-provider";
import { getCurrentUser, getSessionToken } from "@/api/session/actions";
import { redirect } from "next/navigation";
import "@/app/globals.css";

async function AuthedShell({ children }: { children: React.ReactNode }) {
  const token = await getSessionToken();
  if (!token) redirect("/");
  const user = await getCurrentUser();
  if (!user) redirect("/");

  return (
    <GatewayProvider initialUser={user}>
      <SidebarProvider defaultOpen>
        <div className="flex w-full min-w-0 max-w-full overflow-hidden">
          <AppSidebar />
          <main className="relative flex-1 min-w-0 max-w-full overflow-hidden">
            <div className="absolute top-0 left-0 z-50 pl-[max(0px,env(safe-area-inset-left))] pt-[max(0px,env(safe-area-inset-top))]">
              <SidebarTrigger className="mt-1.5 ml-1.5 size-9 shrink-0 fixed" />
            </div>
            {children}
            <Toaster position="top-right" />
          </main>
        </div>
      </SidebarProvider>
    </GatewayProvider>
  );
}

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={null}>
      <AuthedShell>{children}</AuthedShell>
    </Suspense>
  );
}
