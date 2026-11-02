"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, FileText, LayoutDashboard, Megaphone, PenLine, Settings, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccountSwitcher } from "./account-switcher";

const nav = [
  { href: "/", label: "แดชบอร์ด", icon: LayoutDashboard },
  { href: "/campaigns", label: "แคมเปญ", icon: Megaphone },
  { href: "/planner", label: "AI วางแผนแคมเปญ", icon: Sparkles },
  { href: "/audiences", label: "AI หากลุ่มเป้าหมาย", icon: Users },
  { href: "/creatives", label: "AI เขียนแอด", icon: PenLine },
  { href: "/automation", label: "ออโต้ปรับงบ", icon: Bot },
  { href: "/reports", label: "รายงาน", icon: FileText },
  { href: "/settings", label: "ตั้งค่า / เชื่อมต่อ", icon: Settings },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <BarChart3 className="h-6 w-6 text-blue-400" />
        <div>
          <div className="font-semibold leading-tight">AI Ads Expert</div>
          <div className="text-xs text-slate-400">Facebook Ads Autopilot</div>
        </div>
      </div>
      <div className="px-3 pb-3">
        <AccountSwitcher />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm transition", active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white")}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 text-[11px] text-slate-500">ขับเคลื่อนด้วย Claude + Meta Marketing API</div>
    </aside>
  );
}
