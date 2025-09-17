import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/sonner";
import "@/app/globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider defaultOpen>
      <div className="flex w-full">
        <AppSidebar />
        <main className="relative flex-1">
          <div className="absolute top-0 left-0">
            <SidebarTrigger className="mt-4.5 ml-1.5 shrink-0 items-center gap-2 transition-[width,height] ease-linear fixed z-50" />
          </div>
          {children}
          <Toaster position="top-right" />
        </main>
      </div>
    </SidebarProvider>
  );
}