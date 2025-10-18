import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import { GoogleAnalytics } from "@next/third-parties/google";

export const metadata: Metadata = {
  metadataBase: new URL("https://bot.uncoverit.org"),
  alternates: { canonical: "/" },
  title: "Discord Bot Client",
  description:
    "Unofficial Discord Bot Client - Interact with Discord Bots online!",
  keywords: [
    "uncover it",
    "discord",
    "discord bots",
    "bot client",
    "discord bot client",
    "online discord bot client",
  ],
  openGraph: {
    title: "Discord Bot Client",
    description: "Interact with Discord Bots online!",
    url: "https://bot.uncoverit.org",
    siteName: "Discord Bot Client",
    locale: "en_US",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large" as const,
      "max-snippet": -1,
    },
  },
  twitter: {
    title: "Discord Bot Client",
    description: "Interact with Discord Bots online!",
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" disableTransitionOnChange enableSystem>
          {children}
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
      <GoogleAnalytics gaId="G-1RKN83QLN1" />
      <Script src="https://api.instatus.com/widget?host=status.uncoverit.org&code=4f0eef87&locale=en" />
    </html>
  );
}
