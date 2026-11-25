"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, FileText, LayoutDashboard, LogOut, Megaphone, Menu, PenLine, Settings, Sparkles, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccountSwitcher } from "./account-switcher";
import { useSetup } from "./setup-status";

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

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 shadow-lg shadow-violet-500/30">
        <Sparkles className="h-5 w-5 text-white" />
      </div>
      <div>
        <div className="font-semibold leading-tight">AI Ads Expert</div>
        <div className="text-[11px] text-muted-foreground">Facebook Ads Autopilot</div>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { data: setup } = useSetup();
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };
  return (
    <>
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
              onClick={onNavigate}
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
      <div className="m-3 space-y-2">
        <div className="rounded-xl glass p-3 text-[11px] text-muted-foreground">
          <div className="mb-1 flex items-center gap-2 text-foreground">
            <span className={cn("pulse-dot inline-block h-2 w-2 rounded-full", setup?.demo ? "bg-amber-400 text-amber-400" : "bg-emerald-400 text-emerald-400")} />
            {setup?.demo ? "โหมดสาธิต (ข้อมูลจำลอง)" : "เชื่อมต่อบัญชีจริง"}
          </div>
          ขับเคลื่อนด้วย Claude + Meta Marketing API
        </div>
        {setup?.auth && (
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground">
            <LogOut className="h-3.5 w-3.5" /> ออกจากระบบ
          </button>
        )}
      </div>
    </>
  );
}

export function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (path === "/login") return null;
  return (
    <>
      {/* จอใหญ่ */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/5 bg-[hsl(var(--sidebar-background))]/80 backdrop-blur-xl md:flex">
        <div className="px-5 py-5"><Logo /></div>
        <NavLinks />
      </aside>
      {/* มือถือ */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-white/5 bg-[hsl(var(--sidebar-background))]/90 px-4 py-3 backdrop-blur-xl md:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} aria-label="เปิดเมนู" className="rounded-lg p-2 hover:bg-white/10"><Menu className="h-5 w-5" /></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-[hsl(var(--sidebar-background))]">
            <div className="flex items-center justify-between px-5 py-5">
              <Logo />
              <button onClick={() => setOpen(false)} aria-label="ปิดเมนู" className="rounded-lg p-2 hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
