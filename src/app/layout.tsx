// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
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
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.png" />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#a63038"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#d4545c"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="The Budo League" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
        <PwaStartupImages />
      </head>
      <body className="bg-background text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
