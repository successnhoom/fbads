import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  default: "bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/30",
  success: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30",
  warning: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30",
  danger: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30",
  muted: "bg-white/5 text-muted-foreground ring-1 ring-white/10",
  purple: "bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-400/30",
  cyan: "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/30",
};

export function Badge({ variant = "default", className, children }: { variant?: keyof typeof styles; className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", styles[variant], className)}>{children}</span>;
}

export function StatusBadge({ status }: { status?: string }) {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE") return <Badge variant="success">เปิดอยู่</Badge>;
  if (s.includes("PAUSED")) return <Badge variant="muted">หยุด</Badge>;
  if (s === "PENDING_REVIEW") return <Badge variant="warning">รอตรวจ</Badge>;
  if (s === "WITH_ISSUES" || s === "DISAPPROVED") return <Badge variant="danger">มีปัญหา</Badge>;
  return <Badge variant="muted">{status || "-"}</Badge>;
}

export function ActionBadge({ type }: { type: string }) {
  const map: Record<string, [string, keyof typeof styles]> = {
    scale_up: ["เพิ่มงบ", "success"], scale_down: ["ลดงบ", "warning"], pause: ["หยุด", "danger"], resume: ["เปิด", "success"],
    keep: ["คงเดิม", "muted"], create: ["สร้าง", "purple"], update_budget: ["ปรับงบ", "cyan"], delete: ["ลบ", "danger"], rename: ["เปลี่ยนชื่อ", "muted"],
  };
  const [label, v] = map[type] || [type, "muted"];
  return <Badge variant={v}>{label}</Badge>;
}

export function StateBadge({ status }: { status: string }) {
  const map: Record<string, [string, keyof typeof styles]> = {
    pending: ["รออนุมัติ", "warning"], applied: ["ทำแล้ว", "success"], rejected: ["ปฏิเสธ", "muted"], failed: ["ล้มเหลว", "danger"], skipped: ["คงเดิม", "muted"],
  };
  const [label, v] = map[status] || [status, "muted"];
  return <Badge variant={v}>{label}</Badge>;
}
