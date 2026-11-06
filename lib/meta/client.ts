import type {
  MetaAd,
  MetaAdAccount,
  MetaAdSet,
  MetaCampaign,
  MetaInsightRow,
  ReachEstimate,
  TargetingInterest,
  TargetingSpec,
} from "./types";

const API_VERSION = process.env.META_API_VERSION || "v25.0";
// META_GRAPH_URL ใช้ชี้ไป mock server ตอนทดสอบ (ปกติไม่ต้องตั้ง)
const GRAPH = process.env.META_GRAPH_URL || `https://graph.facebook.com/${API_VERSION}`;

/** fetch พร้อมข้อความ error ที่อ่านรู้เรื่องเมื่อต่อ Meta ไม่ได้ (DNS/เน็ต/proxy) */
async function graphFetch(url: string, init?: RequestInit) {
  try {
    return await fetch(url, { cache: "no-store", ...init });
  } catch (e) {
    const cause = (e as { cause?: { message?: string; code?: string } }).cause;
    throw new MetaApiError(`เชื่อมต่อ Meta API ไม่ได้: ${cause?.code || cause?.message || (e as Error).message}`, { status: 0 });
  }
}

export class MetaApiError extends Error {
  code?: number;
  subcode?: number;
  userMessage?: string;
  status: number;
  constructor(message: string, opts: { code?: number; subcode?: number; userMessage?: string; status: number }) {
    super(message);
    this.name = "MetaApiError";
    this.code = opts.code;
    this.subcode = opts.subcode;
    this.userMessage = opts.userMessage;
    this.status = opts.status;
  }
}

/** สกุลเงินที่ Meta ไม่ใช้ทศนิยม (offset = 1) ที่เหลือใช้ minor units (offset = 100) */
const ZERO_DECIMAL = new Set(["CLP", "COP", "HUF", "IDR", "ISK", "JPY", "KRW", "PYG", "TWD", "VND"]);
export function currencyOffset(currency: string) {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100;
}
export function toMinor(amount: number, currency: string) {
  return Math.round(amount * currencyOffset(currency));
}
export function fromMinor(minor: string | number | undefined, currency: string) {
  if (minor == null) return undefined;
  return Number(minor) / currencyOffset(currency);
}

export const INSIGHT_FIELDS = [
  "date_start",
  "date_stop",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "objective",
  "spend",
  "impressions",
  "reach",
  "clicks",
  "frequency",
  "cpm",
  "cpc",
  "ctr",
  "actions",
  "action_values",
  "cost_per_action_type",
  "purchase_roas",
].join(",");

type Params = Record<string, string | number | boolean | object | undefined>;

export class MetaClient {
  constructor(private accessToken: string) {}

  private encode(params: Params) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      sp.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    sp.set("access_token", this.accessToken);
    return sp;
  }

  async get<T = unknown>(path: string, params: Params = {}): Promise<T> {
    const url = `${GRAPH}/${path.replace(/^\//, "")}?${this.encode(params)}`;
    const res = await graphFetch(url);
    return this.handle<T>(res);
  }

  async post<T = unknown>(path: string, params: Params = {}): Promise<T> {
    const url = `${GRAPH}/${path.replace(/^\//, "")}`;
    const res = await graphFetch(url, { method: "POST", body: this.encode(params) });
    return this.handle<T>(res);
  }

  async delete<T = unknown>(path: string): Promise<T> {
    const url = `${GRAPH}/${path.replace(/^\//, "")}?${this.encode({})}`;
    const res = await graphFetch(url, { method: "DELETE" });
    return this.handle<T>(res);
  }

  private async handle<T>(res: Response): Promise<T> {
    const text = await res.text();
    let json: unknown = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new MetaApiError(`Meta API ตอบกลับไม่ใช่ JSON (${res.status})`, { status: res.status });
    }
    const err = (json as { error?: { message: string; code?: number; error_subcode?: number; error_user_msg?: string } }).error;
    if (!res.ok || err) {
      throw new MetaApiError(err?.message || `Meta API error ${res.status}`, {
        status: res.status,
        code: err?.code,
        subcode: err?.error_subcode,
        userMessage: err?.error_user_msg,
      });
    }
    return json as T;
  }

  /** ดึงทุกหน้า (paging.next) */
  async getAll<T = unknown>(path: string, params: Params = {}, maxPages = 20): Promise<T[]> {
    const out: T[] = [];
    let page = await this.get<{ data: T[]; paging?: { next?: string } }>(path, { limit: 100, ...params });
    out.push(...(page.data || []));
    let n = 1;
    while (page.paging?.next && n < maxPages) {
      const res = await graphFetch(page.paging.next);
      page = await this.handle<{ data: T[]; paging?: { next?: string } }>(res);
      out.push(...(page.data || []));
      n++;
    }
    return out;
  }

  // ---------- ตัวตน / บัญชี ----------
  me() {
    return this.get<{ id: string; name: string }>("me", { fields: "id,name" });
  }

  adAccounts() {
    return this.getAll<MetaAdAccount>("me/adaccounts", {
      fields: "id,account_id,name,currency,timezone_name,account_status,business{id,name}",
    });
  }

  adAccount(accountId: string) {
    return this.get<MetaAdAccount>(accountId, {
      fields: "id,account_id,name,currency,timezone_name,account_status,business{id,name}",
    });
  }

  pages() {
    return this.getAll<{ id: string; name: string; access_token?: string }>("me/accounts", { fields: "id,name" });
  }

  pixels(accountId: string) {
    return this.getAll<{ id: string; name: string }>(`${accountId}/adspixels`, { fields: "id,name" });
  }

  customAudiences(accountId: string) {
    return this.getAll<{ id: string; name: string; subtype: string; approximate_count_lower_bound?: number }>(
      `${accountId}/customaudiences`,
      { fields: "id,name,subtype,approximate_count_lower_bound" },
    );
  }

  // ---------- โครงสร้างแคมเปญ ----------
  campaigns(accountId: string) {
    return this.getAll<MetaCampaign>(`${accountId}/campaigns`, {
      fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget,bid_strategy,created_time,start_time,stop_time",
      effective_status: ["ACTIVE", "PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "PENDING_REVIEW", "WITH_ISSUES"],
    });
  }

  adSets(accountId: string) {
    return this.getAll<MetaAdSet>(`${accountId}/adsets`, {
      fields: "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_amount,targeting,start_time,end_time",
      effective_status: ["ACTIVE", "PAUSED", "CAMPAIGN_PAUSED", "PENDING_REVIEW", "WITH_ISSUES"],
    });
  }

  ads(accountId: string) {
    return this.getAll<MetaAd>(`${accountId}/ads`, {
      fields: "id,name,adset_id,campaign_id,status,effective_status,creative{id,name,thumbnail_url}",
      effective_status: ["ACTIVE", "PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "PENDING_REVIEW", "WITH_ISSUES", "DISAPPROVED"],
    });
  }

  // ---------- Insights ----------
  insights(
    accountId: string,
    opts: {
      level: "account" | "campaign" | "adset" | "ad";
      since: string;
      until: string;
      daily?: boolean;
      breakdowns?: string[];
      filtering?: Array<{ field: string; operator: string; value: unknown }>;
    },
  ) {
    return this.getAll<MetaInsightRow>(`${accountId}/insights`, {
      level: opts.level,
      fields: INSIGHT_FIELDS,
      time_range: { since: opts.since, until: opts.until },
      time_increment: opts.daily ? 1 : "all_days",
      breakdowns: opts.breakdowns?.length ? opts.breakdowns.join(",") : undefined,
      filtering: opts.filtering,
      limit: 500,
    });
  }

  // ---------- Targeting ----------
  searchInterests(q: string, limit = 15) {
    return this.get<{ data: TargetingInterest[] }>("search", {
      type: "adinterest",
      q,
      limit,
      locale: "th_TH",
    }).then((r) => r.data || []);
  }

  interestSuggestions(names: string[], limit = 20) {
    return this.get<{ data: TargetingInterest[] }>("search", {
      type: "adinterestsuggestion",
      interest_list: names,
      limit,
      locale: "th_TH",
    }).then((r) => r.data || []);
  }

  async deliveryEstimate(accountId: string, targeting: TargetingSpec, optimizationGoal = "REACH"): Promise<ReachEstimate> {
    const r = await this.get<{ data: Array<{ estimate_mau_lower_bound?: number; estimate_mau_upper_bound?: number; estimate_ready?: boolean }> }>(
      `${accountId}/delivery_estimate`,
      { targeting_spec: targeting, optimization_goal: optimizationGoal },
    );
    const d = r.data?.[0] || {};
    return { users_lower_bound: d.estimate_mau_lower_bound, users_upper_bound: d.estimate_mau_upper_bound, estimate_ready: d.estimate_ready };
  }

  // ---------- เขียน / แก้ไข ----------
  updateStatus(entityId: string, status: "ACTIVE" | "PAUSED") {
    return this.post<{ success: boolean }>(entityId, { status });
  }

  updateDailyBudget(entityId: string, amount: number, currency: string) {
    return this.post<{ success: boolean }>(entityId, { daily_budget: toMinor(amount, currency) });
  }

  updateName(entityId: string, name: string) {
    return this.post<{ success: boolean }>(entityId, { name });
  }

  /** ลบ campaign / ad set / ad (Meta จะตั้งสถานะเป็น DELETED) */
  deleteEntity(entityId: string) {
    return this.delete<{ success: boolean }>(entityId);
  }

  updateTargeting(adsetId: string, targeting: TargetingSpec) {
    return this.post<{ success: boolean }>(adsetId, { targeting });
  }

  createCampaign(
    accountId: string,
    p: { name: string; objective: string; dailyBudget?: number; currency: string; status?: "ACTIVE" | "PAUSED"; specialAdCategories?: string[] },
  ) {
    return this.post<{ id: string }>(`${accountId}/campaigns`, {
      name: p.name,
      objective: p.objective,
      status: p.status || "PAUSED",
      special_ad_categories: p.specialAdCategories || [],
      buying_type: "AUCTION",
      daily_budget: p.dailyBudget ? toMinor(p.dailyBudget, p.currency) : undefined,
      bid_strategy: p.dailyBudget ? "LOWEST_COST_WITHOUT_CAP" : undefined,
    });
  }

  createAdSet(
    accountId: string,
    p: {
      name: string;
      campaignId: string;
      dailyBudget?: number;
      currency: string;
      optimizationGoal: string;
      billingEvent?: string;
      targeting: TargetingSpec;
      promotedObject?: Record<string, unknown>;
      destinationType?: string;
      status?: "ACTIVE" | "PAUSED";
      startTime?: string;
    },
  ) {
    return this.post<{ id: string }>(`${accountId}/adsets`, {
      name: p.name,
      campaign_id: p.campaignId,
      daily_budget: p.dailyBudget ? toMinor(p.dailyBudget, p.currency) : undefined,
      billing_event: p.billingEvent || "IMPRESSIONS",
      optimization_goal: p.optimizationGoal,
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: p.targeting,
      promoted_object: p.promotedObject,
      destination_type: p.destinationType,
      status: p.status || "PAUSED",
      start_time: p.startTime,
    });
  }

  createLinkAdCreative(
    accountId: string,
    p: {
      name: string;
      pageId: string;
      instagramActorId?: string;
      link: string;
      message: string;
      headline: string;
      description?: string;
      imageUrl?: string;
      imageHash?: string;
      callToAction?: string;
    },
  ) {
    const link_data: Record<string, unknown> = {
      link: p.link,
      message: p.message,
      name: p.headline,
      description: p.description,
      call_to_action: { type: p.callToAction || "LEARN_MORE", value: { link: p.link } },
    };
    if (p.imageHash) link_data.image_hash = p.imageHash;
    else if (p.imageUrl) link_data.picture = p.imageUrl;
    return this.post<{ id: string }>(`${accountId}/adcreatives`, {
      name: p.name,
      object_story_spec: { page_id: p.pageId, instagram_actor_id: p.instagramActorId, link_data },
      degrees_of_freedom_spec: { creative_features_spec: { standard_enhancements: { enroll_status: "OPT_OUT" } } },
    });
  }

  createAd(accountId: string, p: { name: string; adsetId: string; creativeId: string; status?: "ACTIVE" | "PAUSED" }) {
    return this.post<{ id: string }>(`${accountId}/ads`, {
      name: p.name,
      adset_id: p.adsetId,
      creative: { creative_id: p.creativeId },
      status: p.status || "PAUSED",
    });
  }

  createLookalike(accountId: string, p: { name: string; sourceAudienceId: string; country: string; ratio?: number }) {
    return this.post<{ id: string }>(`${accountId}/customaudiences`, {
      name: p.name,
      subtype: "LOOKALIKE",
      origin_audience_id: p.sourceAudienceId,
      lookalike_spec: { type: "similarity", country: p.country, ratio: p.ratio ?? 0.01 },
    });
  }
}

// ---------- OAuth ----------
export function oauthUrl(state: string) {
  const appId = process.env.META_APP_ID;
  if (!appId) throw new Error("ยังไม่ได้ตั้งค่า META_APP_ID");
  const redirect = `${process.env.APP_URL}/api/auth/facebook/callback`;
  const scope = ["ads_management", "ads_read", "business_management", "pages_show_list", "pages_read_engagement"].join(",");
  const sp = new URLSearchParams({ client_id: appId, redirect_uri: redirect, scope, state, response_type: "code" });
  return `https://www.facebook.com/${API_VERSION}/dialog/oauth?${sp}`;
}

export async function exchangeCodeForLongLivedToken(code: string) {
  const appId = process.env.META_APP_ID!;
  const secret = process.env.META_APP_SECRET!;
  const redirect = `${process.env.APP_URL}/api/auth/facebook/callback`;
  const short = await graphFetch(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({ client_id: appId, client_secret: secret, redirect_uri: redirect, code })}`,
  ).then((r) => r.json());
  if (!short.access_token) throw new Error(short.error?.message || "แลก code เป็น token ไม่สำเร็จ");
  const long = await graphFetch(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: secret,
      fb_exchange_token: short.access_token,
    })}`,
  ).then((r) => r.json());
  if (!long.access_token) throw new Error(long.error?.message || "แลก long-lived token ไม่สำเร็จ");
  return { token: long.access_token as string, expiresIn: Number(long.expires_in || 5184000) };
}
