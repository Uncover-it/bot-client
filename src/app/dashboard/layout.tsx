import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar";
import { ThemeProvider } from "next-themes";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" disableTransitionOnChange enableSystem>
          <SidebarProvider>
            <AppSidebar />
            <main>
              <SidebarTrigger />
              {children}
              <Toaster position="top-right" />
            </main>
          </SidebarProvider>
        </ThemeProvider>
      </body>
      <Script src="https://api.instatus.com/widget?host=status.uncoverit.org&code=4f0eef87&locale=en" />
    </html>
  );
}
