import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  muted: "bg-muted text-muted-foreground",
  purple: "bg-violet-100 text-violet-800",
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
    keep: ["คงเดิม", "muted"], create: ["สร้าง", "purple"], update_budget: ["ปรับงบ", "default"],
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
