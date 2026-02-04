"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  Medal,
  Users,
  Bell,
  LogOut,
  Settings,
  HeartPulse,
  Star,
} from "lucide-react";

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Latest" },
  { href: "/dashboard/fantasy", icon: HeartPulse, label: "Fantasy" },
  { href: "/dashboard/matches", icon: CalendarDays, label: "Matches" },
  { href: "/dashboard/teams", icon: Users, label: "Teams" },
  { href:"/dashboard/players", icon: Users, label: "Players" },
  { href: "/dashboard/scores", icon: Medal, label: "Results" },
  { href: "/dashboard/notifications", icon: Bell, label: "Notifications" },
  { href: "/dashboard/reviews", icon: Star, label: "Reviews" },
];

// Active if exactly equal OR a child route (keeps highlight when deep in a section)
function isActiveRoute(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-3 py-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-xl p-2 hover:bg-sidebar-accent transition-colors group-data-[collapsible=icon]:justify-center"
          >
            {/* ✅ Your real logo (text is inside the PNG) */}
            <div className="rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-border overflow-hidden">
              <img
                src="/icon.png"
                alt="Budo League"
                className="h-8 w-auto object-contain scale-[1.6]"
                style={{ transformOrigin: "center" }}
                loading="eager"
              />
            </div>

            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="text-sm font-semibold leading-tight truncate font-headline">
                Budo League
              </div>
              <div className="text-xs text-muted-foreground truncate">
                Sunday League Dashboard
              </div>
            </div>
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <div className="px-3 pb-2">
          <div className="px-2 text-[11px] font-medium text-muted-foreground tracking-wide uppercase group-data-[collapsible=icon]:hidden">
            Menu
          </div>
        </div>

        <SidebarMenu>
          {navItems.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            const Icon = item.icon;

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.label}
                  className="rounded-xl"
                >
                  <Link href={item.href} className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-sidebar-accent transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:size-10">
              <Avatar className="size-9">
                <AvatarImage
                  src="https://picsum.photos/seed/admin/100/100"
                  alt="Admin"
                  data-ai-hint="person avatar"
                />
                <AvatarFallback>A</AvatarFallback>
              </Avatar>

              <div className="min-w-0 text-left group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-semibold truncate">League Admin</p>
                <p className="text-xs text-muted-foreground truncate">
                  admin@pl.com
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
