import { z } from "zod";
import { handler, ok } from "@/lib/api";
import { requireAccount } from "@/lib/accounts";
import { loadAccountSnapshot } from "@/lib/meta/data";
import { askJSON } from "@/lib/ai/claude";
import { compactEntity } from "@/lib/meta/insights";
import { buildBrief } from "@/lib/summary";

const Schema = z.object({
  headline: z.string().describe("สรุป 1 ประโยค ภาษาง่าย ๆ สำหรับเจ้าของร้าน"),
  explanation: z.string().describe("อธิบาย 3-5 ประโยค ว่าเกิดอะไรขึ้นกับโฆษณา เพราะอะไร"),
  wins: z.array(z.string()).max(4),
  problems: z.array(z.string()).max(4),
  next_steps: z.array(z.object({ text: z.string(), priority: z.enum(["สูง", "กลาง", "ต่ำ"]), expected_impact: z.string() })).max(5),
});

/** AI วิเคราะห์เชิงลึกสำหรับแดชบอร์ด (ใช้ Claude) */
export const POST = handler(async (req) => {
  const body = (await req.json().catch(() => ({}))) as { accountId?: string; days?: number };
  const { account, client, settings } = await requireAccount(body.accountId);
  const snap = await loadAccountSnapshot(client, account.id, account.currency, Math.min(30, body.days || 7), { withBreakdowns: true });
  const brief = buildBrief(snap, { cpa: settings.targetCpa, roas: settings.targetRoas, minSpend: settings.minSpendToJudge });
  const result = await askJSON({
    schema: Schema,
    effort: "medium",
    user: `อธิบายผลโฆษณาของบัญชี "${account.name}" ช่วง ${snap.since} ถึง ${snap.until} (สกุลเงิน ${account.currency}) ให้เจ้าของธุรกิจที่ไม่ใช่นักการตลาดเข้าใจ ใช้ภาษาง่าย เปรียบเทียบให้เห็นภาพ ไม่ใช้ศัพท์เทคนิคโดยไม่อธิบาย

เป้าหมาย: CPA ${settings.targetCpa ?? "ไม่ตั้ง"} / ROAS ${settings.targetRoas ?? "ไม่ตั้ง"}
สรุปจากกฎตัวเลข: ${JSON.stringify(brief)}
บัญชี: ${JSON.stringify(compactEntity(snap.account))}
แคมเปญ: ${JSON.stringify(snap.campaigns.map(compactEntity))}
ad sets: ${JSON.stringify(snap.adsets.map((a) => ({ ...compactEntity(a), daily: undefined })))}
อายุ/เพศ: ${JSON.stringify(snap.breakdowns.ageGender.map((b) => ({ age: b.age, gender: b.gender, spend: Math.round(b.spend), results: b.results })))}
placement: ${JSON.stringify(snap.breakdowns.placement.map((b) => ({ platform: b.platform, position: b.position, spend: Math.round(b.spend), results: b.results })))}`,
  });
  return ok({ brief, ai: result, period: { since: snap.since, until: snap.until } });
});
