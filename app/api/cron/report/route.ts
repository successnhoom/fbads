import { fail, ok, requireCronAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { buildReport } from "@/lib/ai/build-report";

export const maxDuration = 300;

/** สร้างรายงานอัตโนมัติ: ?type=daily (ทุกเช้า) หรือ ?type=weekly (ทุกวันจันทร์) */
export async function GET(req: Request) {
  try {
    requireCronAuth(req);
    const type = (new URL(req.url).searchParams.get("type") as "daily" | "weekly") || "daily";
    const accounts = await prisma.adAccount.findMany();
    const results = [];
    for (const a of accounts) {
      try {
        const r = await buildReport(a.id, type);
        const settings = await prisma.automationSettings.findUnique({ where: { accountId: a.id } });
        if (settings?.notifyWebhookUrl) {
          const text = `📊 ${r.title} – ${a.name}\n${r.markdown.slice(0, 1500)}\n...\n${process.env.APP_URL}/reports/${r.id}`;
          await fetch(settings.notifyWebhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, content: text }) }).catch(() => undefined);
        }
        results.push({ accountId: a.id, ok: true, reportId: r.id });
      } catch (e) {
        results.push({ accountId: a.id, ok: false, error: (e as Error).message });
      }
    }
    return ok({ ran: results.length, results });
  } catch (e) {
    return fail(e, (e as { status?: number }).status || 500);
  }
}
