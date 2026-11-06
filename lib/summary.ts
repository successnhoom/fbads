/**
 * สรุปผลโฆษณาเป็นภาษาคนแบบทันที (ไม่ต้องเรียก AI) จาก snapshot
 * ใช้เป็น "AI Brief" บนแดชบอร์ด และเป็นข้อมูลตั้งต้นให้ Claude วิเคราะห์เชิงลึก
 */
import type { AccountSnapshot } from "@/lib/meta/data";
import { pctChange } from "@/lib/meta/insights";

export interface Brief {
  score: number; // 0-100 สุขภาพบัญชี
  grade: "ดีมาก" | "ดี" | "พอใช้" | "ต้องแก้" | "ไม่มีข้อมูล";
  headline: string;
  bullets: Array<{ tone: "good" | "warn" | "bad" | "info"; text: string }>;
  actions: Array<{ text: string; entityId?: string; entityName?: string; kind?: "scale_up" | "scale_down" | "pause" | "creative" | "info" }>;
  stats: { activeCampaigns: number; activeAdsets: number; learningAdsets: number; dailyBudgetTotal: number; projectedMonthly: number };
}

const money = (n: number) => Math.round(n).toLocaleString("th-TH");
const resultLabel = (t: string) =>
  ({ purchase: "การซื้อ", lead: "ลีด", messaging: "ข้อความ", link_click: "คลิก", post_engagement: "การมีส่วนร่วม", reach: "การเข้าถึง", app_install: "ติดตั้งแอป", mixed: "ผลลัพธ์" } as Record<string, string>)[t] || "ผลลัพธ์";

export function buildBrief(snap: AccountSnapshot, targets: { cpa?: number | null; roas?: number | null; minSpend?: number } = {}): Brief {
  const m = snap.account.metrics;
  const p = snap.account.prevMetrics;
  const active = (e: { effectiveStatus?: string; status?: string }) => (e.effectiveStatus || e.status || "").toUpperCase() === "ACTIVE";
  const activeCampaigns = snap.campaigns.filter(active);
  const activeAdsets = snap.adsets.filter(active);
  const minSpend = targets.minSpend ?? 300;
  const learning = activeAdsets.filter((a) => a.metrics.spend < minSpend);
  const dailyBudgetTotal = activeAdsets.reduce((s, a) => s + (a.dailyBudget ?? 0), 0) + activeCampaigns.reduce((s, c) => s + (c.dailyBudget ?? 0), 0);
  const stats = { activeCampaigns: activeCampaigns.length, activeAdsets: activeAdsets.length, learningAdsets: learning.length, dailyBudgetTotal, projectedMonthly: dailyBudgetTotal * 30 };

  const bullets: Brief["bullets"] = [];
  const actions: Brief["actions"] = [];

  if (m.spend === 0) {
    return {
      score: 0,
      grade: "ไม่มีข้อมูล",
      headline: activeCampaigns.length ? "แคมเปญเปิดอยู่แต่ยังไม่มีการใช้จ่ายในช่วงนี้" : "ยังไม่มีโฆษณาที่กำลังรันอยู่",
      bullets: [
        { tone: "info", text: activeCampaigns.length ? `มี ${activeCampaigns.length} แคมเปญเปิดอยู่ แต่ไม่มี impression – ตรวจสอบสถานะ ad set, วิธีชำระเงิน หรือการอนุมัติโฆษณา` : "เริ่มต้นได้โดยให้ AI วางแผนแคมเปญแรก หรือสร้างแคมเปญจากปุ่ม + ด้านบน" },
      ],
      actions: [{ text: "ให้ AI วางแผนแคมเปญใหม่", kind: "info" }],
      stats,
    };
  }

  // ---- คะแนนสุขภาพ ----
  let score = 60;
  const spendChange = p ? pctChange(m.spend, p.spend) : 0;
  const resultChange = p ? pctChange(m.results, p.results) : 0;
  const cpaChange = p && p.cpa ? pctChange(m.cpa, p.cpa) : 0;

  // CPA เทียบเป้า
  if (targets.cpa && m.cpa) {
    const r = m.cpa / targets.cpa;
    if (r <= 0.8) { score += 20; bullets.push({ tone: "good", text: `ต้นทุนต่อ${resultLabel(m.resultType)} ${money(m.cpa)} บาท ต่ำกว่าเป้า ${money(targets.cpa)} บาท ถึง ${Math.round((1 - r) * 100)}% – คุ้มมาก` }); }
    else if (r <= 1) { score += 10; bullets.push({ tone: "good", text: `ต้นทุนต่อ${resultLabel(m.resultType)} ${money(m.cpa)} บาท อยู่ในเป้า (${money(targets.cpa)} บาท)` }); }
    else if (r <= 1.3) { score -= 10; bullets.push({ tone: "warn", text: `ต้นทุนต่อ${resultLabel(m.resultType)} ${money(m.cpa)} บาท แพงกว่าเป้า ${Math.round((r - 1) * 100)}%` }); }
    else { score -= 25; bullets.push({ tone: "bad", text: `ต้นทุนต่อ${resultLabel(m.resultType)} ${money(m.cpa)} บาท แพงกว่าเป้า ${money(targets.cpa)} บาท มาก (${Math.round(r * 100)}%)` }); }
  } else if (m.results > 0) {
    bullets.push({ tone: "info", text: `ได้ ${m.results.toLocaleString("th-TH")} ${resultLabel(m.resultType)} ต้นทุนเฉลี่ย ${money(m.cpa)} บาทต่อครั้ง (ยังไม่ได้ตั้งเป้า CPA – ตั้งได้ที่หน้าออโต้ปรับงบ)` });
  } else {
    score -= 25;
    bullets.push({ tone: "bad", text: `ใช้เงินไป ${money(m.spend)} บาท แต่ยังไม่มี${resultLabel(m.resultType)}เลย – ตรวจ pixel/เป้าหมายการวัดผล หรือครีเอทีฟ` });
  }

  // ROAS
  if (m.roas > 0) {
    if (targets.roas) {
      if (m.roas >= targets.roas) { score += 10; bullets.push({ tone: "good", text: `ROAS ${m.roas.toFixed(2)} เท่า ถึงเป้า ${targets.roas} เท่าแล้ว (ขายได้ ${money(m.revenue)} บาท)` }); }
      else { score -= 10; bullets.push({ tone: "warn", text: `ROAS ${m.roas.toFixed(2)} เท่า ยังไม่ถึงเป้า ${targets.roas} เท่า` }); }
    } else bullets.push({ tone: m.roas >= 2 ? "good" : "info", text: `ทุก 1 บาทที่จ่าย ได้ยอดขายกลับมา ${m.roas.toFixed(2)} บาท (รวม ${money(m.revenue)} บาท)` });
  }

  // เทรนด์
  if (p && p.spend > 0) {
    if (m.results > 0 && p.results > 0) {
      if (cpaChange < -15) { score += 8; bullets.push({ tone: "good", text: `ต้นทุนดีขึ้น ${Math.abs(Math.round(cpaChange))}% เทียบช่วงก่อนหน้า` }); }
      else if (cpaChange > 20) { score -= 8; bullets.push({ tone: "warn", text: `ต้นทุนแย่ลง ${Math.round(cpaChange)}% เทียบช่วงก่อนหน้า` }); }
    }
    bullets.push({ tone: "info", text: `ใช้จ่าย ${money(m.spend)} บาท (${spendChange >= 0 ? "+" : ""}${Math.round(spendChange)}%) ได้ ${m.results.toLocaleString("th-TH")} ${resultLabel(m.resultType)} (${resultChange >= 0 ? "+" : ""}${Math.round(resultChange)}%)` });
  } else {
    bullets.push({ tone: "info", text: `ใช้จ่าย ${money(m.spend)} บาท แสดงผล ${m.impressions.toLocaleString("th-TH")} ครั้ง เข้าถึง ${m.reach.toLocaleString("th-TH")} คน` });
  }

  // CTR / frequency
  if (m.ctr > 0 && m.ctr < 0.7) { score -= 8; bullets.push({ tone: "warn", text: `CTR ${m.ctr.toFixed(2)}% ต่ำ คนเห็นแล้วไม่ค่อยกด – ครีเอทีฟ/ข้อความอาจไม่ดึงดูด` }); actions.push({ text: "ให้ AI เขียนข้อความโฆษณาชุดใหม่", kind: "creative" }); }
  else if (m.ctr >= 2) { score += 5; bullets.push({ tone: "good", text: `CTR ${m.ctr.toFixed(2)}% สูง ครีเอทีฟดึงดูดดี` }); }
  if (m.frequency >= 3.5) { score -= 8; bullets.push({ tone: "warn", text: `คนเดิมเห็นโฆษณาซ้ำเฉลี่ย ${m.frequency.toFixed(1)} ครั้ง เริ่มเบื่อ – ควรขยายกลุ่มเป้าหมายหรือเปลี่ยนครีเอทีฟ` }); }

  // best / worst adset
  const judged = snap.adsets.filter((a) => a.metrics.spend >= minSpend);
  const withResults = judged.filter((a) => a.metrics.results > 0).sort((a, b) => a.metrics.cpa - b.metrics.cpa);
  if (withResults.length >= 2) {
    const best = withResults[0];
    const worst = withResults[withResults.length - 1];
    if (worst.metrics.cpa > best.metrics.cpa * 1.8) {
      bullets.push({ tone: "info", text: `"${best.name}" คุ้มสุด (${money(best.metrics.cpa)} บาท/${resultLabel(best.metrics.resultType)}) ส่วน "${worst.name}" แพงกว่า ${(worst.metrics.cpa / best.metrics.cpa).toFixed(1)} เท่า` });
      if (active(best) && best.dailyBudget) actions.push({ text: `เพิ่มงบ "${best.name}" +20%`, entityId: best.id, entityName: best.name, kind: "scale_up" });
      if (active(worst) && worst.dailyBudget) actions.push({ text: `ลดงบ "${worst.name}" -20%`, entityId: worst.id, entityName: worst.name, kind: "scale_down" });
    }
  }
  const noResult = judged.filter((a) => a.metrics.results === 0 && active(a) && a.metrics.spend >= minSpend * 2);
  for (const a of noResult.slice(0, 2)) actions.push({ text: `หยุด "${a.name}" (ใช้ ${money(a.metrics.spend)} บาท ไม่มีผลลัพธ์)`, entityId: a.id, entityName: a.name, kind: "pause" });
  if (learning.length) bullets.push({ tone: "info", text: `${learning.length} ad set ยังอยู่ช่วงเรียนรู้ (ใช้จ่ายไม่ถึง ${money(minSpend)} บาท) รออีกสักพักก่อนตัดสิน` });

  score = Math.max(0, Math.min(100, score));
  const grade: Brief["grade"] = score >= 80 ? "ดีมาก" : score >= 65 ? "ดี" : score >= 45 ? "พอใช้" : "ต้องแก้";
  const headline =
    grade === "ดีมาก" ? `โฆษณาทำผลงานดีมาก ได้ ${m.results.toLocaleString("th-TH")} ${resultLabel(m.resultType)} จากงบ ${money(m.spend)} บาท`
    : grade === "ดี" ? `ภาพรวมดี ใช้ ${money(m.spend)} บาท ได้ ${m.results.toLocaleString("th-TH")} ${resultLabel(m.resultType)} ยังมีจุดให้สเกลได้`
    : grade === "พอใช้" ? `ผลงานกลาง ๆ ใช้ ${money(m.spend)} บาท ได้ ${m.results.toLocaleString("th-TH")} ${resultLabel(m.resultType)} ควรปรับบางจุด`
    : `ต้องรีบแก้ ใช้ ${money(m.spend)} บาท แต่ผลลัพธ์ไม่คุ้ม`;

  return { score, grade, headline, bullets: bullets.slice(0, 6), actions: actions.slice(0, 4), stats };
}
