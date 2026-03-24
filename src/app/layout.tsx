// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeColorMeta } from "@/components/ThemeColorMeta";
import { LaunchGate } from "@/components/launch-gate";
import { PwaStartupImages } from "@/app/pwa-startup-images";

export const metadata: Metadata = {
  title: "The Budo League",
  description: "The Budo League fantasy & fixtures app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <link rel="manifest" href="/manifest.json" />
        {/* favicon.ico served automatically by Next.js from src/app/favicon.ico */}
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#FFFFFF"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#FF0000"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="The Budo League" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/apple-icon-180.png" />
        <PwaStartupImages />
      </head>
      <body className="bg-background text-foreground">
        <ThemeProvider>
          <ThemeColorMeta />
          <LaunchGate>{children}</LaunchGate>
        </ThemeProvider>
      </body>
    </html>
  );
}
