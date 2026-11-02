import { askText } from "./claude";
import { compactEntity, pctChange } from "@/lib/meta/insights";
import type { AccountSnapshot } from "@/lib/meta/data";
import type { Metrics } from "@/lib/meta/types";

export interface ReportMetricsSummary {
  spend: number; results: number; cpa: number; roas: number; ctr: number; cpc: number; cpm: number;
  impressions: number; reach: number; frequency: number; revenue: number;
  changes: Record<string, number>;
  topAdsets: Array<{ name: string; spend: number; results: number; cpa: number }>;
  worstAdsets: Array<{ name: string; spend: number; results: number; cpa: number }>;
}

export function summarize(snap: AccountSnapshot): ReportMetricsSummary {
  const m = snap.account.metrics;
  const p = snap.account.prevMetrics;
  const change = (k: keyof Metrics) => (p ? pctChange(m[k] as number, p[k] as number) : 0);
  const judged = snap.adsets.filter((a) => a.metrics.spend > 0);
  const withResults = judged.filter((a) => a.metrics.results > 0).sort((a, b) => a.metrics.cpa - b.metrics.cpa);
  const row = (a: (typeof judged)[number]) => ({ name: a.name, spend: a.metrics.spend, results: a.metrics.results, cpa: a.metrics.cpa });
  return {
    spend: m.spend, results: m.results, cpa: m.cpa, roas: m.roas, ctr: m.ctr, cpc: m.cpc, cpm: m.cpm,
    impressions: m.impressions, reach: m.reach, frequency: m.frequency, revenue: m.revenue,
    changes: { spend: change("spend"), results: change("results"), cpa: change("cpa"), roas: change("roas"), ctr: change("ctr"), cpc: change("cpc"), cpm: change("cpm") },
    topAdsets: withResults.slice(0, 5).map(row),
    worstAdsets: [...withResults.slice(-5).reverse(), ...judged.filter((a) => a.metrics.results === 0).slice(0, 3)].map(row),
  };
}

/** รายงานละเอียดเป็น markdown ภาษาไทย */
export async function generateReportMarkdown(
  snap: AccountSnapshot,
  opts: { type: "daily" | "weekly" | "custom"; accountName: string; targetCpa?: number | null; targetRoas?: number | null; recentActions?: Array<{ entityName: string; actionType: string; reason: string; status: string }> },
) {
  const summary = summarize(snap);
  const r = (n: number, d = 2) => Number(n.toFixed(d));
  const data = {
    period: { since: snap.since, until: snap.until, prev: { since: snap.prevSince, until: snap.prevUntil } },
    currency: snap.currency,
    targets: { cpa: opts.targetCpa ?? null, roas: opts.targetRoas ?? null },
    account: compactEntity(snap.account),
    campaigns: snap.campaigns.map(compactEntity),
    adsets: snap.adsets.map((a) => ({ ...compactEntity(a), daily: undefined })),
    ads_top: snap.ads
      .filter((a) => a.metrics.spend > 0)
      .sort((a, b) => b.metrics.spend - a.metrics.spend)
      .slice(0, 15)
      .map(compactEntity),
    breakdown_age_gender: snap.breakdowns.ageGender.map((b) => ({ age: b.age, gender: b.gender, spend: r(b.spend), results: b.results, cpa: r(b.cpa), ctr: r(b.ctr) })),
    breakdown_placement: snap.breakdowns.placement.map((b) => ({ platform: b.platform, position: b.position, spend: r(b.spend), results: b.results, cpa: r(b.cpa), ctr: r(b.ctr) })),
    recent_ai_actions: opts.recentActions ?? [],
  };

  const typeLabel = opts.type === "daily" ? "รายวัน" : opts.type === "weekly" ? "รายสัปดาห์" : "ตามช่วงที่กำหนด";
  const md = await askText({
    effort: "high",
    user: `เขียน "รายงานผลโฆษณา${typeLabel}" ของบัญชี "${opts.accountName}" เป็น Markdown ภาษาไทย อ่านง่ายสำหรับเจ้าของธุรกิจแต่ละเอียดพอสำหรับนักการตลาด

ข้อมูล (JSON):
${JSON.stringify(data, null, 1)}

โครงสร้างที่ต้องมี (ใช้หัวข้อ ## ):
1. สรุปผู้บริหาร – 3-5 bullet ตัวเลขสำคัญ (ใช้จ่าย, ผลลัพธ์, CPA, ROAS, CTR) พร้อม % เปลี่ยนแปลงเทียบช่วงก่อน และ "ผ่าน/ไม่ผ่าน" เทียบเป้าหมาย
2. ภาพรวมบัญชี – ตาราง metric ปัจจุบัน vs ช่วงก่อน
3. ผลตามแคมเปญ – ตาราง + ข้อสังเกตแต่ละแคมเปญ
4. ผลตาม Ad set – ตารางเรียงตาม CPA/ROAS, ระบุตัวที่ดีที่สุด/แย่ที่สุด และตัวที่ยังอยู่ใน learning
5. ครีเอทีฟ (ads) ที่เด่น/ควรหยุด (ถ้ามีข้อมูล)
6. กลุ่มเป้าหมาย: อายุ/เพศ และ placement ไหนคุ้มที่สุด (ถ้ามีข้อมูล)
7. สิ่งที่ AI ได้ทำไปแล้วในช่วงนี้ (recent_ai_actions ถ้ามี)
8. ปัญหา/ความเสี่ยงที่พบ (เช่น frequency สูง, CTR ตก, งบกระจุก)
9. แผนการปรับในรอบถัดไป – รายการสั่งการที่ลงมือได้ทันที เรียงตามความสำคัญ พร้อมผลที่คาดหวัง

กติกา: ทุกตัวเลขต้องมาจากข้อมูล ห้ามแต่ง ใช้สกุลเงิน ${snap.currency} ปัดทศนิยมพอดี ๆ ถ้าข้อมูลส่วนไหนว่าง ให้บอกว่าไม่มีข้อมูล`,
  });
  return { markdown: md, summary };
}
