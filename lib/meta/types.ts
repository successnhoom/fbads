// ชนิดข้อมูลหลักจาก Meta Marketing API ที่ระบบใช้

export type MetaStatus = "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";

export interface MetaAdAccount {
  id: string; // act_xxx
  account_id: string;
  name: string;
  currency: string;
  timezone_name: string;
  account_status: number;
  business?: { id: string; name: string };
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: MetaStatus;
  effective_status: string;
  objective: string;
  daily_budget?: string; // หน่วยเป็นสตางค์ (minor units)
  lifetime_budget?: string;
  bid_strategy?: string;
  created_time?: string;
  start_time?: string;
  stop_time?: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  campaign_id: string;
  status: MetaStatus;
  effective_status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  billing_event?: string;
  bid_amount?: string;
  targeting?: Record<string, unknown>;
  start_time?: string;
  end_time?: string;
}

export interface MetaAd {
  id: string;
  name: string;
  adset_id: string;
  campaign_id: string;
  status: MetaStatus;
  effective_status: string;
  creative?: { id: string; name?: string; thumbnail_url?: string };
}

export interface MetaActionValue {
  action_type: string;
  value: string;
}

export interface MetaInsightRow {
  date_start: string;
  date_stop: string;
  account_id?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  frequency?: string;
  cpm?: string;
  cpc?: string;
  ctr?: string;
  actions?: MetaActionValue[];
  action_values?: MetaActionValue[];
  cost_per_action_type?: MetaActionValue[];
  purchase_roas?: MetaActionValue[];
  objective?: string;
  // breakdowns
  age?: string;
  gender?: string;
  publisher_platform?: string;
  platform_position?: string;
  country?: string;
  region?: string;
}

/** ตัวเลขที่ normalize แล้ว ใช้ทั้งใน UI, AI และ optimizer */
export interface Metrics {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number; // %
  cpc: number;
  cpm: number;
  frequency: number;
  results: number; // จำนวนผลลัพธ์ตาม objective (purchase/lead/message ฯลฯ)
  resultType: string;
  cpa: number; // cost per result
  revenue: number; // มูลค่า conversion (ถ้ามี)
  roas: number;
  purchases: number;
  leads: number;
  messages: number;
  linkClicks: number;
  landingPageViews: number;
  addToCart: number;
}

export interface EntityWithMetrics {
  id: string;
  name: string;
  level: "account" | "campaign" | "adset" | "ad";
  status?: string;
  effectiveStatus?: string;
  campaignId?: string;
  campaignName?: string;
  adsetId?: string;
  dailyBudget?: number; // หน่วยเงินจริง (ไม่ใช่สตางค์)
  lifetimeBudget?: number;
  objective?: string;
  optimizationGoal?: string;
  metrics: Metrics;
  prevMetrics?: Metrics; // ช่วงก่อนหน้า (เทียบเทรนด์)
  daily?: Array<{ date: string } & Metrics>;
}

export interface TargetingInterest {
  id: string;
  name: string;
  audience_size_lower_bound?: number;
  audience_size_upper_bound?: number;
  path?: string[];
  topic?: string;
}

export interface TargetingSpec {
  geo_locations: {
    countries?: string[];
    cities?: Array<{ key: string; radius?: number; distance_unit?: string }>;
    regions?: Array<{ key: string }>;
  };
  age_min?: number;
  age_max?: number;
  genders?: number[]; // 1 = ชาย, 2 = หญิง
  flexible_spec?: Array<{
    interests?: Array<{ id: string; name?: string }>;
    behaviors?: Array<{ id: string; name?: string }>;
  }>;
  exclusions?: Record<string, unknown>;
  custom_audiences?: Array<{ id: string }>;
  excluded_custom_audiences?: Array<{ id: string }>;
  publisher_platforms?: string[];
  facebook_positions?: string[];
  instagram_positions?: string[];
  locales?: number[];
  targeting_automation?: { advantage_audience: 0 | 1 };
}

export interface ReachEstimate {
  users_lower_bound?: number;
  users_upper_bound?: number;
  estimate_ready?: boolean;
}
