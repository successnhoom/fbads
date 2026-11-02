import type { EntityWithMetrics, MetaActionValue, MetaInsightRow, Metrics } from "./types";

const num = (v: string | number | undefined | null) => (v == null || v === "" ? 0 : Number(v)) || 0;

function action(list: MetaActionValue[] | undefined, ...types: string[]) {
  if (!list) return 0;
  for (const t of types) {
    const hit = list.find((a) => a.action_type === t);
    if (hit) return num(hit.value);
  }
  return 0;
}

/** เลือก "ผลลัพธ์" หลักตาม objective ของแคมเปญ */
export function resultTypeFor(objective?: string, optimizationGoal?: string): { type: string; label: string } {
  const o = (objective || "").toUpperCase();
  const g = (optimizationGoal || "").toUpperCase();
  if (g.includes("CONVERSATIONS") || o.includes("MESSAGES")) return { type: "messaging", label: "ข้อความ" };
  if (o.includes("SALES") || o.includes("CONVERSIONS") || g.includes("OFFSITE_CONVERSIONS")) return { type: "purchase", label: "การซื้อ" };
  if (o.includes("LEADS") || g.includes("LEAD")) return { type: "lead", label: "ลีด" };
  if (o.includes("TRAFFIC") || g.includes("LINK_CLICKS") || g.includes("LANDING_PAGE")) return { type: "link_click", label: "คลิกลิงก์" };
  if (o.includes("ENGAGEMENT") || g.includes("ENGAGEMENT")) return { type: "post_engagement", label: "การมีส่วนร่วม" };
  if (o.includes("AWARENESS") || g.includes("REACH") || g.includes("IMPRESSIONS")) return { type: "reach", label: "การเข้าถึง" };
  if (o.includes("APP")) return { type: "app_install", label: "ติดตั้งแอป" };
  return { type: "link_click", label: "คลิกลิงก์" };
}

export function emptyMetrics(resultType = "link_click"): Metrics {
  return {
    spend: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0, frequency: 0,
    results: 0, resultType, cpa: 0, revenue: 0, roas: 0, purchases: 0, leads: 0, messages: 0,
    linkClicks: 0, landingPageViews: 0, addToCart: 0,
  };
}

export function normalizeRow(row: MetaInsightRow, objective?: string, optimizationGoal?: string): Metrics {
  const spend = num(row.spend);
  const impressions = num(row.impressions);
  const clicks = num(row.clicks);
  const purchases = action(row.actions, "omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase", "onsite_conversion.purchase");
  const leads = action(row.actions, "lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead");
  const messages = action(row.actions, "onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.total_messaging_connection");
  const linkClicks = action(row.actions, "link_click");
  const landingPageViews = action(row.actions, "landing_page_view", "omni_landing_page_view");
  const addToCart = action(row.actions, "omni_add_to_cart", "add_to_cart", "offsite_conversion.fb_pixel_add_to_cart");
  const postEngagement = action(row.actions, "post_engagement", "page_engagement");
  const appInstall = action(row.actions, "omni_app_install", "mobile_app_install", "app_install");
  const revenue = action(row.action_values, "omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase");
  const reach = num(row.reach);

  const rt = resultTypeFor(objective || row.objective, optimizationGoal);
  const resultsByType: Record<string, number> = {
    purchase: purchases, lead: leads, messaging: messages, link_click: linkClicks,
    post_engagement: postEngagement, reach, app_install: appInstall,
  };
  const results = resultsByType[rt.type] ?? 0;
  const roasFromApi = row.purchase_roas?.find((r) => r.action_type === "omni_purchase")?.value;

  return {
    spend,
    impressions,
    reach,
    clicks,
    ctr: impressions ? (clicks / impressions) * 100 : 0,
    cpc: clicks ? spend / clicks : 0,
    cpm: impressions ? (spend / impressions) * 1000 : 0,
    frequency: num(row.frequency) || (reach ? impressions / reach : 0),
    results,
    resultType: rt.type,
    cpa: results ? spend / results : 0,
    revenue,
    roas: roasFromApi ? num(roasFromApi) : spend ? revenue / spend : 0,
    purchases,
    leads,
    messages,
    linkClicks,
    landingPageViews,
    addToCart,
  };
}

/** รวมหลายแถว (เช่น รายวัน) เป็นก้อนเดียว */
export function sumMetrics(list: Metrics[], resultType?: string): Metrics {
  const m = emptyMetrics(resultType || list[0]?.resultType);
  for (const x of list) {
    m.spend += x.spend; m.impressions += x.impressions; m.reach += x.reach; m.clicks += x.clicks;
    m.results += x.results; m.revenue += x.revenue; m.purchases += x.purchases; m.leads += x.leads;
    m.messages += x.messages; m.linkClicks += x.linkClicks; m.landingPageViews += x.landingPageViews; m.addToCart += x.addToCart;
  }
  m.ctr = m.impressions ? (m.clicks / m.impressions) * 100 : 0;
  m.cpc = m.clicks ? m.spend / m.clicks : 0;
  m.cpm = m.impressions ? (m.spend / m.impressions) * 1000 : 0;
  m.frequency = m.reach ? m.impressions / m.reach : 0;
  m.cpa = m.results ? m.spend / m.results : 0;
  m.roas = m.spend ? m.revenue / m.spend : 0;
  return m;
}

export function pctChange(now: number, prev: number) {
  if (!prev) return now ? 100 : 0;
  return ((now - prev) / prev) * 100;
}

/** สรุปสำหรับส่งให้ AI (ตัวเลขปัดแล้ว กระชับ) */
export function compactEntity(e: EntityWithMetrics) {
  const m = e.metrics;
  const r = (n: number, d = 2) => Number(n.toFixed(d));
  return {
    id: e.id,
    name: e.name,
    level: e.level,
    status: e.effectiveStatus || e.status,
    campaign: e.campaignName,
    objective: e.objective,
    optimization_goal: e.optimizationGoal,
    daily_budget: e.dailyBudget,
    spend: r(m.spend),
    impressions: m.impressions,
    reach: m.reach,
    clicks: m.clicks,
    ctr_pct: r(m.ctr),
    cpc: r(m.cpc),
    cpm: r(m.cpm),
    frequency: r(m.frequency),
    results: m.results,
    result_type: m.resultType,
    cpa: r(m.cpa),
    revenue: r(m.revenue),
    roas: r(m.roas),
    prev: e.prevMetrics
      ? { spend: r(e.prevMetrics.spend), results: e.prevMetrics.results, cpa: r(e.prevMetrics.cpa), roas: r(e.prevMetrics.roas), ctr_pct: r(e.prevMetrics.ctr) }
      : undefined,
    daily: e.daily?.map((d) => ({ date: d.date, spend: r(d.spend), results: d.results, cpa: r(d.cpa), ctr_pct: r(d.ctr) })),
  };
}
