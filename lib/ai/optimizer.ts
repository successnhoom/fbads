import { z } from "zod";
import { askJSON } from "./claude";
import { compactEntity } from "@/lib/meta/insights";
import type { EntityWithMetrics } from "@/lib/meta/types";
import { analyzeSignals, applyGuardrails, ruleBasedProposal, type ProposedAction, type RuleSettings } from "@/lib/automation/rules";

const DecisionSchema = z.object({
  overall_assessment: z.string().describe("ภาพรวมบัญชีวันนี้ 2-4 ประโยค"),
  decisions: z.array(
    z.object({
      adset_id: z.string(),
      action: z.enum(["scale_up", "scale_down", "pause", "resume", "keep"]),
      new_daily_budget: z.number().nullable().describe("งบใหม่ต่อวัน (ใส่เฉพาะ scale_up/scale_down)"),
      reason: z.string().describe("เหตุผลภาษาไทย อ้างอิงตัวเลข"),
      confidence: z.number().min(0).max(1),
    }),
  ),
  watchlist: z.array(z.string()).describe("สิ่งที่ควรจับตาในรอบถัดไป"),
  creative_notes: z.array(z.string()).describe("ข้อสังเกตด้านครีเอทีฟ/กลุ่มเป้าหมายที่ควรปรับ"),
});
export type OptimizerDecision = z.infer<typeof DecisionSchema>;

export interface OptimizeResult {
  assessment: string;
  actions: ProposedAction[];
  watchlist: string[];
  creativeNotes: string[];
  ruleOnly: boolean;
}

/**
 * ขั้นตอน: 1) กฎตัวเลขวิเคราะห์สัญญาณ + เสนอ action เบื้องต้น
 *          2) AI พิจารณาภาพรวม ตัดสินขั้นสุดท้ายพร้อมเหตุผล
 *          3) Guardrails บังคับเพดานทุกอย่าง
 */
export async function optimizeAdsets(
  adsets: EntityWithMetrics[],
  settings: RuleSettings,
  ctx: { currency: string; lookbackDays: number; useAI?: boolean },
): Promise<OptimizeResult> {
  const candidates = adsets.filter((a) => (a.effectiveStatus || a.status || "").toUpperCase() !== "DELETED");
  const signals = candidates.map((a) => analyzeSignals(a, settings));
  const ruleProposals = candidates.map((a, i) => ruleBasedProposal(a, settings, signals[i]));

  if (ctx.useAI === false || !process.env.ANTHROPIC_API_KEY) {
    return {
      assessment: "ตัดสินด้วยกฎเชิงตัวเลขเท่านั้น (ไม่ได้ใช้ AI)",
      actions: applyGuardrails(ruleProposals, candidates, settings),
      watchlist: [],
      creativeNotes: [],
      ruleOnly: true,
    };
  }

  const payload = candidates.map((a, i) => ({
    ...compactEntity(a),
    signals: signals[i].tags,
    rule_notes: signals[i].notes,
    rule_proposal: { action: ruleProposals[i].actionType, new_budget: ruleProposals[i].newBudget },
  }));

  const decision = await askJSON({
    schema: DecisionSchema,
    effort: "high",
    user: `ตัดสินใจปรับงบ/สถานะ ad set จากข้อมูล ${ctx.lookbackDays} วันล่าสุด (สกุลเงิน ${ctx.currency})

เป้าหมายและข้อจำกัดของบัญชี:
- เพดานงบรวมต่อวัน: ${settings.dailyBudgetCap}
- Target CPA: ${settings.targetCpa ?? "ไม่กำหนด"} | Target ROAS: ${settings.targetRoas ?? "ไม่กำหนด"}
- ปรับงบได้ไม่เกิน ${settings.maxChangePct}% ต่อรอบ, งบ ad set อยู่ระหว่าง ${settings.minAdsetBudget}-${settings.maxAdsetBudget}
- ใช้จ่ายขั้นต่ำก่อนตัดสิน: ${settings.minSpendToJudge}

ad sets (พร้อมสัญญาณจากกฎตัวเลข และข้อเสนอเบื้องต้น):
${JSON.stringify(payload, null, 1)}

ให้ตัดสินทุก ad set (ต้องมีครบทุก adset_id) โดย:
- เคารพ learning phase (signals มี "learning" → keep)
- ถ้าเห็นด้วยกับ rule_proposal ให้ใช้ และเพิ่มเหตุผลเชิงลึก ถ้าไม่เห็นด้วยให้อธิบาย
- มองภาพรวม: ย้ายงบจากตัวแย่ไปตัวดี, ไม่ปล่อยให้ตัวดีชนเพดานงบรวม
- new_daily_budget ต้องอยู่ในกรอบ ±${settings.maxChangePct}% ของงบปัจจุบัน`,
  });

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const aiActions: ProposedAction[] = decision.decisions
    .filter((d) => byId.has(d.adset_id))
    .map((d) => {
      const e = byId.get(d.adset_id)!;
      return {
        entityType: "adset",
        entityId: e.id,
        entityName: e.name,
        actionType: d.action,
        currentBudget: e.dailyBudget,
        newBudget: d.new_daily_budget ?? e.dailyBudget,
        reason: d.reason,
        confidence: d.confidence,
        signals: signals[candidates.indexOf(e)].tags,
      };
    });
  // ad set ที่ AI ลืมตัดสิน → ใช้ข้อเสนอจากกฎ
  for (const rp of ruleProposals) if (!aiActions.some((a) => a.entityId === rp.entityId)) aiActions.push(rp);

  return {
    assessment: decision.overall_assessment,
    actions: applyGuardrails(aiActions, candidates, settings),
    watchlist: decision.watchlist,
    creativeNotes: decision.creative_notes,
    ruleOnly: false,
  };
}
