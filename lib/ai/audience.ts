import { z } from "zod";
import { askJSON } from "./claude";
import type { MetaClient } from "@/lib/meta/client";
import type { TargetingInterest, TargetingSpec } from "@/lib/meta/types";

export const AudienceBriefSchema = z.object({
  product: z.string().min(2),
  goal: z.string().optional(),
  countries: z.array(z.string()).default(["TH"]),
  budgetPerDay: z.number().optional(),
  extra: z.string().optional(),
});
export type AudienceBrief = z.infer<typeof AudienceBriefSchema>;

const SegmentSchema = z.object({
  name: z.string().describe("ชื่อกลุ่มเป้าหมายสั้น ๆ ภาษาไทย"),
  persona: z.string().describe("อธิบายว่าคนกลุ่มนี้คือใคร ทำไมถึงซื้อ"),
  rationale: z.string().describe("เหตุผลเชิงกลยุทธ์ว่าทำไมควรทดสอบกลุ่มนี้"),
  age_min: z.number().int().min(13).max(65),
  age_max: z.number().int().min(13).max(65),
  genders: z.array(z.enum(["male", "female"])).describe("ว่างเปล่า = ทุกเพศ"),
  interest_keywords: z.array(z.string()).min(2).max(8).describe("คำค้นหา interest ภาษาอังกฤษสำหรับ Meta targeting search"),
  interest_keywords_th: z.array(z.string()).max(6).describe("คำค้นหา interest ภาษาไทย (ถ้ามี)"),
  placements: z.enum(["advantage", "feeds_only", "reels_stories"]).describe("รูปแบบ placement แนะนำ"),
  angle: z.string().describe("มุมการสื่อสาร/ข้อความหลักที่ควรใช้กับกลุ่มนี้"),
  priority: z.number().int().min(1).max(5).describe("1 = ทดสอบก่อน"),
  suggested_budget_share_pct: z.number().min(0).max(100),
});

const AudiencePlanSchema = z.object({
  summary: z.string().describe("สรุปกลยุทธ์กลุ่มเป้าหมายโดยรวม 2-4 ประโยค"),
  segments: z.array(SegmentSchema).min(3).max(6),
  broad_recommendation: z.string().describe("ควรทดสอบ Advantage+ audience / broad ควบคู่ด้วยหรือไม่ เพราะอะไร"),
  exclusions: z.array(z.string()).describe("กลุ่มที่ควร exclude เช่น ลูกค้าเดิม"),
});
export type AudiencePlan = z.infer<typeof AudiencePlanSchema>;

export async function generateAudiencePlan(brief: AudienceBrief): Promise<AudiencePlan> {
  return askJSON({
    schema: AudiencePlanSchema,
    effort: "high",
    user: `ช่วยวางกลยุทธ์กลุ่มเป้าหมาย (audience) สำหรับยิงแอด Meta Ads ให้สินค้า/บริการนี้

สินค้า/บริการ: ${brief.product}
เป้าหมายแคมเปญ: ${brief.goal || "ยอดขาย/ผลลัพธ์"}
ประเทศ: ${brief.countries.join(", ")}
งบต่อวัน: ${brief.budgetPerDay ? `${brief.budgetPerDay} (สกุลเงินของบัญชี)` : "ไม่ระบุ"}
ข้อมูลเพิ่มเติม: ${brief.extra || "-"}

ข้อกำหนด:
- เสนอ 3-6 segment ที่แตกต่างกันจริง ๆ (ห้ามซ้ำกันแค่เปลี่ยนชื่อ) ครอบคลุม: กลุ่มตรง (core), กลุ่มใกล้เคียง (adjacent), และกลุ่มกว้าง
- interest_keywords ต้องเป็นคำที่ Meta มีจริงใน interest targeting (เช่น "Online shopping", "Skin care", "Coffee") ไม่ใช่ประโยค
- กระจาย suggested_budget_share_pct ให้รวมกันได้ 100
- คิดถึง learning phase: ถ้างบน้อย ควรลดจำนวน segment`,
  });
}

export interface ResolvedSegment {
  name: string;
  persona: string;
  rationale: string;
  angle: string;
  priority: number;
  budgetSharePct: number;
  placements: string;
  interests: TargetingInterest[];
  missingKeywords: string[];
  targeting: TargetingSpec;
  estimate?: { lower?: number; upper?: number };
}

function placementSpec(p: string): Partial<TargetingSpec> {
  if (p === "feeds_only") return { publisher_platforms: ["facebook", "instagram"], facebook_positions: ["feed"], instagram_positions: ["stream"] };
  if (p === "reels_stories")
    return { publisher_platforms: ["facebook", "instagram"], facebook_positions: ["story", "facebook_reels"], instagram_positions: ["story", "reels"] };
  return {};
}

/** แปลง keyword ของ AI → interest จริงใน Meta + ประเมินขนาด audience */
export async function resolveSegments(client: MetaClient, accountId: string, plan: AudiencePlan, countries: string[]): Promise<ResolvedSegment[]> {
  const out: ResolvedSegment[] = [];
  for (const seg of plan.segments) {
    const interests: TargetingInterest[] = [];
    const missing: string[] = [];
    const keywords = [...seg.interest_keywords, ...seg.interest_keywords_th];
    for (const kw of keywords) {
      try {
        const found = await client.searchInterests(kw, 3);
        const best = found.find((f) => f.name.toLowerCase() === kw.toLowerCase()) || found[0];
        if (best && !interests.some((i) => i.id === best.id)) interests.push(best);
        else if (!best) missing.push(kw);
      } catch {
        missing.push(kw);
      }
    }
    const targeting: TargetingSpec = {
      geo_locations: { countries },
      age_min: seg.age_min,
      age_max: seg.age_max,
      genders: seg.genders.length === 1 ? [seg.genders[0] === "male" ? 1 : 2] : undefined,
      flexible_spec: interests.length ? [{ interests: interests.map((i) => ({ id: i.id, name: i.name })) }] : undefined,
      targeting_automation: { advantage_audience: interests.length ? 0 : 1 },
      ...placementSpec(seg.placements),
    };
    let estimate: ResolvedSegment["estimate"];
    try {
      const est = await client.deliveryEstimate(accountId, targeting);
      estimate = { lower: est.users_lower_bound, upper: est.users_upper_bound };
    } catch {
      estimate = undefined;
    }
    out.push({
      name: seg.name,
      persona: seg.persona,
      rationale: seg.rationale,
      angle: seg.angle,
      priority: seg.priority,
      budgetSharePct: seg.suggested_budget_share_pct,
      placements: seg.placements,
      interests,
      missingKeywords: missing,
      targeting,
      estimate,
    });
  }
  return out.sort((a, b) => a.priority - b.priority);
}
