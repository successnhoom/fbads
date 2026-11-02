import { requireAccount } from "@/lib/accounts";
import { loadAccountSnapshot } from "@/lib/meta/data";
import { generateReportMarkdown } from "@/lib/ai/report";
import { prisma } from "@/lib/db";

/** ดึงข้อมูล → ให้ AI เขียนรายงาน → บันทึกลงฐานข้อมูล */
export async function buildReport(accountId: string | null | undefined, type: "daily" | "weekly" | "custom", days?: number) {
  const { account, client, settings } = await requireAccount(accountId);
  const lookback = type === "daily" ? 1 : type === "weekly" ? 7 : Math.min(90, Math.max(1, days || 7));
  const snap = await loadAccountSnapshot(client, account.id, account.currency, lookback, { withAds: true, withBreakdowns: true });
  const recent = await prisma.actionLog.findMany({
    where: { accountId: account.id, createdAt: { gte: new Date(Date.now() - lookback * 86400000) }, status: { in: ["applied", "pending", "failed"] } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const { markdown, summary } = await generateReportMarkdown(snap, {
    type,
    accountName: account.name,
    targetCpa: settings.targetCpa,
    targetRoas: settings.targetRoas,
    recentActions: recent.map((r) => ({ entityName: r.entityName, actionType: r.actionType, reason: r.reason, status: r.status })),
  });
  const title = `${type === "daily" ? "รายงานรายวัน" : type === "weekly" ? "รายงานรายสัปดาห์" : `รายงาน ${lookback} วัน`} ${snap.since}${snap.since !== snap.until ? ` ถึง ${snap.until}` : ""}`;
  return prisma.report.create({
    data: { accountId: account.id, type, periodFrom: snap.since, periodTo: snap.until, title, markdown, metricsJson: JSON.stringify(summary) },
  });
}

