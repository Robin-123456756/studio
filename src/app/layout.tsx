import type { Metadata } from "next";
import "./globals.css";

import MobileBottomNav from "@/components/mobile-bottom-nav";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "TBL",
  description: "The Budo League.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>

      <body className="font-body antialiased bg-background text-foreground">
        <main className="min-h-screen pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>

        <MobileBottomNav />
        <Toaster />
      </body>
    </html>
  );
}
