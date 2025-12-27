import type { ReactNode } from "react";
import type { Viewport } from "next";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import Header from "@/components/header";
import MobileBottomNav from "@/components/mobile-bottom-nav";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      {/* Desktop sidebar only */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      <SidebarInset className="min-w-0">
        <Header />

        {/* Prevent horizontal scroll + keep content centered */}
        <main className="min-w-0 overflow-x-hidden pb-24 md:pb-0">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            {children}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
