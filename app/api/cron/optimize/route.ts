import { fail, ok, requireCronAuth } from "@/lib/api";
import { ensureSchema, prisma } from "@/lib/db";
import { runOptimization } from "@/lib/automation/run";

export const maxDuration = 300;

/** เรียกโดย cron (Vercel Cron / GitHub Actions / cron-job.org) ทุก ๆ ชั่วโมงหรือวันละครั้ง */
export async function GET(req: Request) {
  try {
    requireCronAuth(req);
    await ensureSchema();
    const accounts = await prisma.adAccount.findMany({ where: { settings: { enabled: true } } });
    const results = [];
    for (const a of accounts) {
      try {
        const s = await runOptimization(a);
        results.push({ accountId: a.id, ok: true, proposed: s.proposed, applied: s.applied, pending: s.pending, failed: s.failed });
      } catch (e) {
        results.push({ accountId: a.id, ok: false, error: (e as Error).message });
      }
    }
    return ok({ ran: results.length, results });
  } catch (e) {
    return fail(e, (e as { status?: number }).status || 500);
  }
}
