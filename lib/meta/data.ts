import type { MetaClient } from "./client";
import { fromMinor } from "./client";
import { emptyMetrics, normalizeRow, resultTypeFor, sumMetrics } from "./insights";
import type { EntityWithMetrics, MetaInsightRow, Metrics } from "./types";
import { daysAgo } from "@/lib/utils";

export interface AccountSnapshot {
  accountId: string;
  currency: string;
  since: string;
  until: string;
  prevSince: string;
  prevUntil: string;
  account: EntityWithMetrics;
  campaigns: EntityWithMetrics[];
  adsets: EntityWithMetrics[];
  ads: EntityWithMetrics[];
  breakdowns: {
    ageGender: Array<{ age: string; gender: string } & Metrics>;
    placement: Array<{ platform: string; position: string } & Metrics>;
  };
}

function groupRows(rows: MetaInsightRow[], key: keyof MetaInsightRow) {
  const map = new Map<string, MetaInsightRow[]>();
  for (const r of rows) {
    const k = String(r[key] ?? "");
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  return map;
}

/**
 * โหลดภาพรวมทั้งบัญชี: โครงสร้าง + insights ช่วงปัจจุบัน/ก่อนหน้า + รายวัน + breakdown
 */
export async function loadAccountSnapshot(
  client: MetaClient,
  accountId: string,
  currency: string,
  lookbackDays = 7,
  opts: { withAds?: boolean; withBreakdowns?: boolean } = {},
): Promise<AccountSnapshot> {
  const until = daysAgo(0);
  const since = daysAgo(lookbackDays - 1);
  const prevUntil = daysAgo(lookbackDays);
  const prevSince = daysAgo(lookbackDays * 2 - 1);

  const [campaigns, adsets, ads, accDaily, accPrev, campCur, campPrev, adsetDaily, adsetPrev, adCur, ageGender, placement] = await Promise.all([
    client.campaigns(accountId),
    client.adSets(accountId),
    opts.withAds ? client.ads(accountId) : Promise.resolve([]),
    client.insights(accountId, { level: "account", since, until, daily: true }),
    client.insights(accountId, { level: "account", since: prevSince, until: prevUntil }),
    client.insights(accountId, { level: "campaign", since, until }),
    client.insights(accountId, { level: "campaign", since: prevSince, until: prevUntil }),
    client.insights(accountId, { level: "adset", since, until, daily: true }),
    client.insights(accountId, { level: "adset", since: prevSince, until: prevUntil }),
    opts.withAds ? client.insights(accountId, { level: "ad", since, until }) : Promise.resolve([] as MetaInsightRow[]),
    opts.withBreakdowns ? client.insights(accountId, { level: "account", since, until, breakdowns: ["age", "gender"] }) : Promise.resolve([] as MetaInsightRow[]),
    opts.withBreakdowns
      ? client.insights(accountId, { level: "account", since, until, breakdowns: ["publisher_platform", "platform_position"] })
      : Promise.resolve([] as MetaInsightRow[]),
  ]);

  const campById = new Map(campaigns.map((c) => [c.id, c]));
  const adsetById = new Map(adsets.map((a) => [a.id, a]));

  // ---- account ----
  const accDailyM = accDaily.map((r) => ({ date: r.date_start, ...normalizeRow(r) }));
  const accountEntity: EntityWithMetrics = {
    id: accountId,
    name: "ทั้งบัญชี",
    level: "account",
    metrics: sumMetrics(accDailyM),
    prevMetrics: sumMetrics(accPrev.map((r) => normalizeRow(r))),
    daily: accDailyM,
  };
  // ผลลัพธ์ระดับบัญชี = ผลรวมของแคมเปญ (เพราะแต่ละแคมเปญมี objective ต่างกัน)
  const campCurByCamp = groupRows(campCur, "campaign_id");
  const campPrevByCamp = groupRows(campPrev, "campaign_id");

  // optimization goal ของแคมเปญ = goal ที่ ad set ส่วนใหญ่ในแคมเปญใช้ (เพื่อเลือก "ผลลัพธ์" ให้ถูก เช่น ทักแชท)
  const campGoal = new Map<string, string>();
  for (const c of campaigns) {
    const goals = adsets.filter((a) => a.campaign_id === c.id).map((a) => a.optimization_goal || "");
    const top = [...new Set(goals)].sort((x, y) => goals.filter((g) => g === y).length - goals.filter((g) => g === x).length)[0];
    if (top) campGoal.set(c.id, top);
  }

  const campaignEntities: EntityWithMetrics[] = campaigns.map((c) => {
    const rows = campCurByCamp.get(c.id) || [];
    const prevRows = campPrevByCamp.get(c.id) || [];
    const goal = campGoal.get(c.id);
    const rt = resultTypeFor(c.objective, goal).type;
    return {
      id: c.id,
      name: c.name,
      level: "campaign",
      status: c.status,
      effectiveStatus: c.effective_status,
      objective: c.objective,
      optimizationGoal: goal,
      dailyBudget: fromMinor(c.daily_budget, currency),
      lifetimeBudget: fromMinor(c.lifetime_budget, currency),
      metrics: rows.length ? sumMetrics(rows.map((r) => normalizeRow(r, c.objective, goal)), rt) : emptyMetrics(rt),
      prevMetrics: prevRows.length ? sumMetrics(prevRows.map((r) => normalizeRow(r, c.objective, goal)), rt) : emptyMetrics(rt),
    };
  });

  // account-level results = sum of campaign results (mixed types)
  const accResults = campaignEntities.reduce((s, c) => s + c.metrics.results, 0);
  const accPrevResults = campaignEntities.reduce((s, c) => s + (c.prevMetrics?.results ?? 0), 0);
  accountEntity.metrics.results = accResults;
  accountEntity.metrics.resultType = "mixed";
  accountEntity.metrics.cpa = accResults ? accountEntity.metrics.spend / accResults : 0;
  if (accountEntity.prevMetrics) {
    accountEntity.prevMetrics.results = accPrevResults;
    accountEntity.prevMetrics.cpa = accPrevResults ? accountEntity.prevMetrics.spend / accPrevResults : 0;
  }

  // ---- adsets ----
  const adsetDailyBy = groupRows(adsetDaily, "adset_id");
  const adsetPrevBy = groupRows(adsetPrev, "adset_id");
  const adsetEntities: EntityWithMetrics[] = adsets.map((a) => {
    const camp = campById.get(a.campaign_id);
    const rt = resultTypeFor(camp?.objective, a.optimization_goal).type;
    const daily = (adsetDailyBy.get(a.id) || [])
      .map((r) => ({ date: r.date_start, ...normalizeRow(r, camp?.objective, a.optimization_goal) }))
      .sort((x, y) => x.date.localeCompare(y.date));
    const prevRows = adsetPrevBy.get(a.id) || [];
    return {
      id: a.id,
      name: a.name,
      level: "adset",
      status: a.status,
      effectiveStatus: a.effective_status,
      campaignId: a.campaign_id,
      campaignName: camp?.name,
      objective: camp?.objective,
      optimizationGoal: a.optimization_goal,
      dailyBudget: fromMinor(a.daily_budget, currency),
      lifetimeBudget: fromMinor(a.lifetime_budget, currency),
      metrics: daily.length ? sumMetrics(daily, rt) : emptyMetrics(rt),
      prevMetrics: prevRows.length ? sumMetrics(prevRows.map((r) => normalizeRow(r, camp?.objective, a.optimization_goal)), rt) : emptyMetrics(rt),
      daily,
    };
  });

  // ---- ads ----
  const adCurBy = groupRows(adCur, "ad_id");
  const adEntities: EntityWithMetrics[] = ads.map((ad) => {
    const adset = adsetById.get(ad.adset_id);
    const camp = campById.get(ad.campaign_id);
    const rt = resultTypeFor(camp?.objective, adset?.optimization_goal).type;
    const rows = adCurBy.get(ad.id) || [];
    return {
      id: ad.id,
      name: ad.name,
      level: "ad",
      status: ad.status,
      effectiveStatus: ad.effective_status,
      campaignId: ad.campaign_id,
      campaignName: camp?.name,
      adsetId: ad.adset_id,
      objective: camp?.objective,
      metrics: rows.length ? sumMetrics(rows.map((r) => normalizeRow(r, camp?.objective, adset?.optimization_goal)), rt) : emptyMetrics(rt),
    };
  });

  return {
    accountId,
    currency,
    since,
    until,
    prevSince,
    prevUntil,
    account: accountEntity,
    campaigns: campaignEntities,
    adsets: adsetEntities,
    ads: adEntities,
    breakdowns: {
      ageGender: ageGender.map((r) => ({ age: r.age || "", gender: r.gender || "", ...normalizeRow(r) })),
      placement: placement.map((r) => ({ platform: r.publisher_platform || "", position: r.platform_position || "", ...normalizeRow(r) })),
    },
  };
}
