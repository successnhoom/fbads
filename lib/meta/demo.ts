/**
 * โหมดสาธิต (DEMO_MODE=1): จำลอง Meta Marketing API ในหน่วยความจำ
 * ใช้ดูหน้าเว็บ/ทดลองกดปุ่มได้โดยไม่ต้องมี token จริง – ข้อมูลรีเซ็ตเมื่อเซิร์ฟเวอร์รีสตาร์ท
 */
import { MetaClient } from "./client";
import type { MetaAd, MetaAdAccount, MetaAdSet, MetaCampaign, MetaInsightRow, ReachEstimate, TargetingInterest, TargetingSpec } from "./types";

export const DEMO_ACCOUNT_ID = "act_demo";

const acct: MetaAdAccount = { id: DEMO_ACCOUNT_ID, account_id: "demo", name: "ร้านสาธิต (Demo)", currency: "THB", timezone_name: "Asia/Bangkok", account_status: 1, business: { id: "b_demo", name: "Demo Business" } };

const state = {
  campaigns: [
    { id: "c1", name: "ขายเซรั่มวิตามินซี - Conversions", status: "ACTIVE", effective_status: "ACTIVE", objective: "OUTCOME_SALES" },
    { id: "c2", name: "ทักแชท Messenger - คอลลาเจน", status: "ACTIVE", effective_status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
    { id: "c3", name: "Retargeting คนเคยเข้าเว็บ", status: "PAUSED", effective_status: "PAUSED", objective: "OUTCOME_SALES" },
  ] as MetaCampaign[],
  adsets: [
    { id: "as1", name: "ผู้หญิง 25-45 สนใจ Skincare", campaign_id: "c1", status: "ACTIVE", effective_status: "ACTIVE", daily_budget: "50000", optimization_goal: "OFFSITE_CONVERSIONS" },
    { id: "as2", name: "Broad / Advantage+ audience", campaign_id: "c1", status: "ACTIVE", effective_status: "ACTIVE", daily_budget: "40000", optimization_goal: "OFFSITE_CONVERSIONS" },
    { id: "as3", name: "Lookalike 1% ลูกค้าเดิม", campaign_id: "c1", status: "ACTIVE", effective_status: "ACTIVE", daily_budget: "30000", optimization_goal: "OFFSITE_CONVERSIONS" },
    { id: "as4", name: "สนใจอาหารเสริม 30-55", campaign_id: "c2", status: "ACTIVE", effective_status: "ACTIVE", daily_budget: "20000", optimization_goal: "CONVERSATIONS" },
    { id: "as5", name: "Website visitors 30 วัน", campaign_id: "c3", status: "PAUSED", effective_status: "CAMPAIGN_PAUSED", daily_budget: "15000", optimization_goal: "OFFSITE_CONVERSIONS" },
  ] as MetaAdSet[],
  ads: [
    { id: "ad1", name: "วิดีโอรีวิว 15 วิ", adset_id: "as1", campaign_id: "c1", status: "ACTIVE", effective_status: "ACTIVE" },
    { id: "ad2", name: "ภาพ Before/After", adset_id: "as1", campaign_id: "c1", status: "ACTIVE", effective_status: "ACTIVE" },
    { id: "ad3", name: "ภาพโปร ซื้อ 1 แถม 1", adset_id: "as2", campaign_id: "c1", status: "ACTIVE", effective_status: "ACTIVE" },
    { id: "ad4", name: "วิดีโอ UGC", adset_id: "as3", campaign_id: "c1", status: "ACTIVE", effective_status: "ACTIVE" },
    { id: "ad5", name: "ทักแชทรับส่วนลด", adset_id: "as4", campaign_id: "c2", status: "ACTIVE", effective_status: "ACTIVE" },
  ] as MetaAd[],
  // [spend/วัน, purchases/วัน, messages/วัน, ctr%]
  perf: { as1: [480, 9, 0, 2.1], as2: [400, 4, 0, 1.2], as3: [300, 5, 0, 1.6], as4: [200, 0, 11, 1.4], as5: [0, 0, 0, 0] } as Record<string, number[]>,
};

function seeded(seed: number) {
  // ตัวเลขสุ่มแบบคงที่ (ให้กราฟดูสมจริงแต่ซ้ำได้)
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return 0.8 + (x - Math.floor(x)) * 0.4;
}
function dayList(since: string, until: string) {
  const out: string[] = [];
  for (let d = new Date(since); d <= new Date(until); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

function rows(level: string, since: string, until: string, daily: boolean, breakdowns: string[]): MetaInsightRow[] {
  const days = dayList(since, until);
  const groups: Array<{ id: string; ids: MetaAdSet[]; attrs: Partial<MetaInsightRow> }> =
    level === "account"
      ? [{ id: "acc", ids: state.adsets, attrs: {} }]
      : level === "campaign"
        ? state.campaigns.map((c) => ({ id: c.id, ids: state.adsets.filter((a) => a.campaign_id === c.id), attrs: { campaign_id: c.id, campaign_name: c.name, objective: c.objective } }))
        : level === "adset"
          ? state.adsets.map((a) => ({ id: a.id, ids: [a], attrs: { adset_id: a.id, adset_name: a.name, campaign_id: a.campaign_id } }))
          : state.ads.map((ad) => ({ id: ad.id, ids: [state.adsets.find((a) => a.id === ad.adset_id)!].filter(Boolean), attrs: { ad_id: ad.id, ad_name: ad.name, adset_id: ad.adset_id, campaign_id: ad.campaign_id } }));
  const segs = breakdowns.includes("age")
    ? [["18-24", "female", 0.15], ["25-34", "female", 0.3], ["35-44", "female", 0.25], ["45-54", "female", 0.1], ["25-34", "male", 0.12], ["35-44", "male", 0.08]]
    : breakdowns.includes("publisher_platform")
      ? [["facebook", "feed", 0.42], ["instagram", "stream", 0.2], ["instagram", "reels", 0.18], ["facebook", "facebook_reels", 0.12], ["instagram", "story", 0.08]]
      : [[null, null, 1]];
  const out: MetaInsightRow[] = [];
  for (const g of groups) {
    const chunks = daily ? days.map((d) => [d, d]) : [[days[0], days[days.length - 1]]];
    for (const [ds, de] of chunks) {
      const dayIdx = days.indexOf(ds);
      const n = daily ? 1 : days.length;
      for (const [k1, k2, share] of segs) {
        let spend = 0, purchases = 0, msgs = 0, impressions = 0, clicks = 0;
        for (const a of g.ids) {
          const perf = state.perf[a.id] || [0, 0, 0, 0];
          const divisor = Number(a.id.replace(/\D/g, "")) || 1;
          const adShare = level === "ad" ? 1 / Math.max(1, state.ads.filter((x) => x.adset_id === a.id).length) : 1;
          for (let i = 0; i < n; i++) {
            const f = seeded(dayIdx + i + divisor) * Number(share) * adShare;
            spend += perf[0] * f;
            purchases += perf[1] * f;
            msgs += perf[2] * f;
            const imp = perf[0] * 40 * f;
            impressions += imp;
            clicks += (imp * perf[3]) / 100;
          }
        }
        if (!g.ids.length) continue;
        out.push({
          date_start: ds, date_stop: de, ...g.attrs,
          ...(breakdowns.includes("age") ? { age: k1 as string, gender: k2 as string } : {}),
          ...(breakdowns.includes("publisher_platform") ? { publisher_platform: k1 as string, platform_position: k2 as string } : {}),
          spend: spend.toFixed(2), impressions: String(Math.round(impressions)), reach: String(Math.round(impressions / 1.7)), clicks: String(Math.round(clicks)),
          frequency: "1.7",
          actions: [
            { action_type: "omni_purchase", value: String(Math.round(purchases)) },
            { action_type: "link_click", value: String(Math.round(clicks * 0.8)) },
            { action_type: "onsite_conversion.messaging_conversation_started_7d", value: String(Math.round(msgs)) },
          ],
          action_values: [{ action_type: "omni_purchase", value: String(Math.round(purchases) * 590) }],
        });
      }
    }
  }
  return out;
}

let seq = 100;

export class DemoMetaClient extends MetaClient {
  constructor() { super("demo-token"); }
  override async me() { return { id: "demo_user", name: "Demo User" }; }
  override async adAccounts() { return [acct]; }
  override async adAccount() { return acct; }
  override async pages() { return [{ id: "page_demo", name: "เพจสาธิต" }]; }
  override async pixels() { return [{ id: "px_demo", name: "Pixel สาธิต" }]; }
  override async customAudiences() { return [{ id: "ca1", name: "ลูกค้าเดิม 180 วัน", subtype: "CUSTOM", approximate_count_lower_bound: 4200 }]; }
  override async campaigns() { return state.campaigns.filter((c) => c.status !== "DELETED"); }
  override async adSets() { return state.adsets.filter((a) => a.status !== "DELETED"); }
  override async ads() { return state.ads.filter((a) => a.status !== "DELETED"); }
  override async insights(_accountId: string, o: { level: "account" | "campaign" | "adset" | "ad"; since: string; until: string; daily?: boolean; breakdowns?: string[] }) {
    return rows(o.level, o.since, o.until, !!o.daily, o.breakdowns || []);
  }
  override async searchInterests(q: string): Promise<TargetingInterest[]> { return [{ id: String(6000000000000 + q.length * 7919), name: q, audience_size_upper_bound: 1500000 + q.length * 100000 }]; }
  override async interestSuggestions(): Promise<TargetingInterest[]> { return []; }
  override async deliveryEstimate(): Promise<ReachEstimate> { return { users_lower_bound: 450000, users_upper_bound: 530000, estimate_ready: true }; }
  override async updateStatus(id: string, status: "ACTIVE" | "PAUSED") {
    const e = [...state.campaigns, ...state.adsets, ...state.ads].find((x) => x.id === id);
    if (!e) throw new Error("ไม่พบรายการ (demo)");
    e.status = status; e.effective_status = status;
    if (state.campaigns.some((c) => c.id === id)) for (const a of state.adsets.filter((a) => a.campaign_id === id)) a.effective_status = status === "PAUSED" ? "CAMPAIGN_PAUSED" : a.status;
    return { success: true };
  }
  override async updateDailyBudget(id: string, amount: number) {
    const e = [...state.campaigns, ...state.adsets].find((x) => x.id === id);
    if (!e) throw new Error("ไม่พบรายการ (demo)");
    e.daily_budget = String(Math.round(amount * 100));
    return { success: true };
  }
  override async updateName(id: string, name: string) {
    const e = [...state.campaigns, ...state.adsets, ...state.ads].find((x) => x.id === id);
    if (!e) throw new Error("ไม่พบรายการ (demo)");
    e.name = name;
    return { success: true };
  }
  override async deleteEntity(id: string) {
    for (const list of [state.campaigns, state.adsets, state.ads] as Array<Array<{ id: string; status: string }>>) {
      const e = list.find((x) => x.id === id);
      if (e) e.status = "DELETED";
    }
    return { success: true };
  }
  override async updateTargeting(_id: string, _t: TargetingSpec) { return { success: true }; }
  override async createCampaign(_a: string, p: { name: string; objective: string; dailyBudget?: number; status?: "ACTIVE" | "PAUSED" }) {
    const id = `c_demo_${++seq}`;
    state.campaigns.push({ id, name: p.name, objective: p.objective, status: p.status || "PAUSED", effective_status: p.status || "PAUSED", daily_budget: p.dailyBudget ? String(Math.round(p.dailyBudget * 100)) : undefined });
    return { id };
  }
  override async createAdSet(_a: string, p: { name: string; campaignId: string; dailyBudget?: number; optimizationGoal: string; targeting: TargetingSpec; status?: "ACTIVE" | "PAUSED" }) {
    const id = `as_demo_${++seq}`;
    state.adsets.push({ id, name: p.name, campaign_id: p.campaignId, status: p.status || "PAUSED", effective_status: p.status || "PAUSED", daily_budget: p.dailyBudget ? String(Math.round(p.dailyBudget * 100)) : undefined, optimization_goal: p.optimizationGoal, targeting: p.targeting as unknown as Record<string, unknown> });
    state.perf[id] = [0, 0, 0, 0];
    return { id };
  }
  override async createLinkAdCreative() { return { id: `cr_demo_${++seq}` }; }
  override async createAd(_a: string, p: { name: string; adsetId: string; status?: "ACTIVE" | "PAUSED" }) {
    const id = `ad_demo_${++seq}`;
    const adset = state.adsets.find((a) => a.id === p.adsetId);
    state.ads.push({ id, name: p.name, adset_id: p.adsetId, campaign_id: adset?.campaign_id || "", status: p.status || "PAUSED", effective_status: p.status || "PAUSED" });
    return { id };
  }
  override async createLookalike() { return { id: `la_demo_${++seq}` }; }
}

/** เปิดโหมดสาธิตเมื่อ DEMO_MODE=1 หรือเมื่อรันบน Vercel แล้วยังไม่ได้ตั้ง DEMO_MODE (ตั้ง DEMO_MODE=0 เพื่อปิด) */
export const isDemoMode = () =>
  process.env.DEMO_MODE === "1" || process.env.DEMO_MODE === "true" || (process.env.DEMO_MODE === undefined && process.env.VERCEL === "1");
