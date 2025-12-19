"use client"
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";

const getPageTitle = (pathname: string) => {
  if (pathname === '/dashboard') return 'Dashboard';
  const segment = pathname.split("/").pop() || "";
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace('-', ' ');
};

export default function Header() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="md:hidden">
        <SidebarTrigger />
      </div>
      <div className="flex-1">
        <h1 className="text-xl font-semibold font-headline">{title}</h1>
      </div>
    </header>
  );
}
