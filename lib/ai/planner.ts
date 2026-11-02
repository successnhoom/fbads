import { z } from "zod";
import { askJSON } from "./claude";
import { CreativeVariantSchema } from "./creative";
import type { MetaClient } from "@/lib/meta/client";
import type { TargetingSpec } from "@/lib/meta/types";

export const PlanBriefSchema = z.object({
  product: z.string().min(2),
  goal: z.enum(["sales", "leads", "messages", "traffic", "awareness"]),
  dailyBudget: z.number().positive(),
  countries: z.array(z.string()).default(["TH"]),
  landingUrl: z.string().url().optional().or(z.literal("")),
  offer: z.string().optional(),
  extra: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
});
export type PlanBrief = z.infer<typeof PlanBriefSchema>;

const AdSetPlanSchema = z.object({
  name: z.string(),
  audience_name: z.string(),
  persona: z.string(),
  age_min: z.number().int().min(13).max(65),
  age_max: z.number().int().min(13).max(65),
  genders: z.array(z.enum(["male", "female"])),
  interest_keywords: z.array(z.string()).max(8).describe("ว่าง = broad / Advantage+ audience"),
  daily_budget: z.number().positive(),
  rationale: z.string(),
  creatives: z.array(CreativeVariantSchema).min(1).max(3),
});

export const CampaignPlanSchema = z.object({
  campaign_name: z.string(),
  objective: z.enum(["OUTCOME_SALES", "OUTCOME_LEADS", "OUTCOME_ENGAGEMENT", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS"]),
  optimization_goal: z.enum(["OFFSITE_CONVERSIONS", "LEAD_GENERATION", "CONVERSATIONS", "LINK_CLICKS", "LANDING_PAGE_VIEWS", "REACH", "IMPRESSIONS"]),
  strategy_summary: z.string().describe("สรุปกลยุทธ์ 3-6 ประโยค"),
  budget_strategy: z.string().describe("ทำไมถึงแบ่งงบแบบนี้ และจะสเกลอย่างไร"),
  adsets: z.array(AdSetPlanSchema).min(2).max(5),
  testing_plan: z.array(z.string()).describe("จะทดสอบอะไร วัดผลเมื่อไร ตัดสินด้วยเกณฑ์อะไร"),
  kpi_targets: z.object({ cpa: z.number().nullable(), roas: z.number().nullable(), ctr_pct: z.number().nullable() }),
  risks: z.array(z.string()),
});
export type CampaignPlan = z.infer<typeof CampaignPlanSchema>;

const GOAL_HINT: Record<PlanBrief["goal"], string> = {
  sales: "objective OUTCOME_SALES + optimization OFFSITE_CONVERSIONS (ต้องมี pixel) ",
  leads: "objective OUTCOME_LEADS + LEAD_GENERATION หรือ OFFSITE_CONVERSIONS",
  messages: "objective OUTCOME_ENGAGEMENT + CONVERSATIONS (ทักแชท Messenger)",
  traffic: "objective OUTCOME_TRAFFIC + LANDING_PAGE_VIEWS หรือ LINK_CLICKS",
  awareness: "objective OUTCOME_AWARENESS + REACH",
};

export async function generateCampaignPlan(brief: PlanBrief, currency: string): Promise<CampaignPlan> {
  return askJSON({
    schema: CampaignPlanSchema,
    effort: "high",
    user: `วางแผนแคมเปญ Meta Ads ฉบับสมบูรณ์ พร้อมลงมือสร้างได้ทันที

สินค้า/บริการ: ${brief.product}
เป้าหมาย: ${brief.goal} → ${GOAL_HINT[brief.goal]}
งบรวมต่อวัน: ${brief.dailyBudget} ${currency} (ผลรวม daily_budget ของทุก ad set ต้องเท่ากับค่านี้พอดี)
ประเทศ: ${brief.countries.join(", ")}
Landing page: ${brief.landingUrl || "-"}
ข้อเสนอ: ${brief.offer || "-"}
ข้อมูลเพิ่มเติม: ${brief.extra || "-"}

กติกา:
- จำนวน ad set เหมาะกับงบ: ถ้างบต่อวันน้อยกว่า 500 ${currency} ใช้ 2 ad set, 500-2000 ใช้ 3, มากกว่านั้น 3-5
- ad set อย่างน้อย 1 ตัวเป็น broad/Advantage+ (interest_keywords ว่าง) เพื่อให้ algorithm หาเอง
- interest_keywords เป็นคำภาษาอังกฤษที่ Meta มีจริง
- ครีเอทีฟแต่ละ ad set 2-3 แบบ มุมต่างกัน ภาษาไทย
- kpi_targets ประเมินจากประเภทสินค้าและตลาดไทย (ให้ตัวเลขที่สมเหตุสมผล)`,
  });
}

export interface LaunchResult {
  campaignId: string;
  adsets: Array<{ id: string; name: string; ads: Array<{ id: string; creativeId: string }>; warnings: string[] }>;
}

/** สร้างแคมเปญจริงใน Meta (สถานะ PAUSED เพื่อให้ตรวจก่อนเปิด) */
export async function launchPlan(
  client: MetaClient,
  p: { accountId: string; currency: string; plan: CampaignPlan; brief: PlanBrief; pageId: string; pixelId?: string | null; status?: "ACTIVE" | "PAUSED" },
): Promise<LaunchResult> {
  const { plan, brief } = p;
  const status = p.status || "PAUSED";
  const camp = await client.createCampaign(p.accountId, { name: plan.campaign_name, objective: plan.objective, currency: p.currency, status });

  const promotedObject: Record<string, unknown> | undefined =
    plan.optimization_goal === "OFFSITE_CONVERSIONS"
      ? p.pixelId
        ? { pixel_id: p.pixelId, custom_event_type: brief.goal === "leads" ? "LEAD" : "PURCHASE" }
        : undefined
      : plan.optimization_goal === "CONVERSATIONS" || plan.optimization_goal === "LEAD_GENERATION"
        ? { page_id: p.pageId }
        : undefined;
  const destinationType = plan.optimization_goal === "CONVERSATIONS" ? "MESSENGER" : undefined;
  const link = brief.landingUrl || `https://www.facebook.com/${p.pageId}`;

  const result: LaunchResult = { campaignId: camp.id, adsets: [] };
  for (const as of plan.adsets) {
    const warnings: string[] = [];
    const interests: Array<{ id: string; name: string }> = [];
    for (const kw of as.interest_keywords) {
      try {
        const found = await client.searchInterests(kw, 1);
        if (found[0]) interests.push({ id: found[0].id, name: found[0].name });
        else warnings.push(`ไม่พบ interest "${kw}"`);
      } catch (e) {
        warnings.push(`ค้นหา interest "${kw}" ไม่สำเร็จ: ${(e as Error).message}`);
      }
    }
    const targeting: TargetingSpec = {
      geo_locations: { countries: brief.countries },
      age_min: as.age_min,
      age_max: as.age_max,
      genders: as.genders.length === 1 ? [as.genders[0] === "male" ? 1 : 2] : undefined,
      flexible_spec: interests.length ? [{ interests }] : undefined,
      targeting_automation: { advantage_audience: interests.length ? 0 : 1 },
    };
    const adset = await client.createAdSet(p.accountId, {
      name: as.name,
      campaignId: camp.id,
      dailyBudget: as.daily_budget,
      currency: p.currency,
      optimizationGoal: plan.optimization_goal,
      targeting,
      promotedObject,
      destinationType,
      status,
    });
    const ads: Array<{ id: string; creativeId: string }> = [];
    for (const [i, c] of as.creatives.entries()) {
      try {
        const creative = await client.createLinkAdCreative(p.accountId, {
          name: `${as.name} - ครีเอทีฟ ${i + 1}`,
          pageId: p.pageId,
          link,
          message: c.primary_text,
          headline: c.headline,
          description: c.description,
          imageUrl: brief.imageUrl || undefined,
          callToAction: c.call_to_action,
        });
        const ad = await client.createAd(p.accountId, { name: `${as.name} - Ad ${i + 1}`, adsetId: adset.id, creativeId: creative.id, status });
        ads.push({ id: ad.id, creativeId: creative.id });
      } catch (e) {
        warnings.push(`สร้างโฆษณา ${i + 1} ไม่สำเร็จ: ${(e as Error).message}`);
      }
    }
    result.adsets.push({ id: adset.id, name: as.name, ads, warnings });
  }
  return result;
}
