"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, FileText, LayoutDashboard, Megaphone, PenLine, Settings, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccountSwitcher } from "./account-switcher";

const nav = [
  { href: "/", label: "แดชบอร์ด AI", icon: LayoutDashboard },
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
    <aside className="hidden w-64 shrink-0 flex-col border-r border-white/5 bg-[hsl(var(--sidebar-background))]/80 backdrop-blur-xl md:flex">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 shadow-lg shadow-violet-500/30">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="font-semibold leading-tight">AI Ads Expert</div>
          <div className="text-[11px] text-muted-foreground">Facebook Ads Autopilot</div>
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
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                active ? "bg-gradient-to-r from-violet-600/80 to-fuchsia-600/60 text-white shadow-lg shadow-violet-900/40" : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-xl glass p-3 text-[11px] text-muted-foreground">
        <div className="mb-1 flex items-center gap-2 text-foreground"><span className="pulse-dot inline-block h-2 w-2 rounded-full bg-emerald-400 text-emerald-400" /> AI พร้อมทำงาน</div>
        ขับเคลื่อนด้วย Claude + Meta Marketing API
      </div>
    </aside>
  );
}
