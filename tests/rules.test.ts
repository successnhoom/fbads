import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeSignals, applyGuardrails, ruleBasedProposal, type RuleSettings } from "../lib/automation/rules";
import { emptyMetrics, normalizeRow, sumMetrics } from "../lib/meta/insights";
import type { EntityWithMetrics } from "../lib/meta/types";
import { fromMinor, toMinor } from "../lib/meta/client";

const settings: RuleSettings = {
  dailyBudgetCap: 1000,
  targetCpa: 100,
  targetRoas: null,
  maxChangePct: 20,
  minSpendToJudge: 300,
  minAdsetBudget: 100,
  maxAdsetBudget: 5000,
  pauseWhenCpaOver: 2,
};

function adset(id: string, budget: number, spend: number, results: number, extra: Partial<EntityWithMetrics["metrics"]> = {}): EntityWithMetrics {
  const m = { ...emptyMetrics("purchase"), spend, results, cpa: results ? spend / results : 0, impressions: 10000, clicks: 150, ctr: 1.5, reach: 5000, frequency: 2, ...extra };
  return { id, name: id, level: "adset", status: "ACTIVE", effectiveStatus: "ACTIVE", dailyBudget: budget, metrics: m };
}

test("ad set ที่ใช้จ่ายน้อย = learning → keep", () => {
  const e = adset("a", 200, 100, 0);
  const sig = analyzeSignals(e, settings);
  assert.ok(sig.tags.includes("learning"));
  assert.equal(ruleBasedProposal(e, settings, sig).actionType, "keep");
});

test("CPA ดีมาก → scale_up ไม่เกิน maxChangePct", () => {
  const e = adset("a", 400, 800, 20); // cpa 40 < 80
  const sig = analyzeSignals(e, settings);
  assert.ok(sig.tags.includes("cpa_great"));
  const p = ruleBasedProposal(e, settings, sig);
  assert.equal(p.actionType, "scale_up");
  assert.equal(p.newBudget, 480);
});

test("CPA เกิน 2 เท่า → pause", () => {
  const e = adset("a", 400, 1000, 4); // cpa 250 >= 200
  const sig = analyzeSignals(e, settings);
  assert.ok(sig.tags.includes("cpa_over_limit"));
  assert.equal(ruleBasedProposal(e, settings, sig).actionType, "pause");
});

test("guardrail จำกัด % การเปลี่ยนงบที่ AI เสนอ", () => {
  const e = adset("a", 400, 800, 20);
  const out = applyGuardrails([{ entityType: "adset", entityId: "a", entityName: "a", actionType: "scale_up", newBudget: 2000, reason: "x", confidence: 0.9, signals: [] }], [e], settings);
  assert.equal(out[0].newBudget, 480);
});

test("guardrail ไม่ให้งบรวมเกินเพดาน", () => {
  const a = adset("a", 500, 900, 20);
  const b = adset("b", 500, 900, 20);
  const out = applyGuardrails(
    [
      { entityType: "adset", entityId: "a", entityName: "a", actionType: "scale_up", newBudget: 600, reason: "x", confidence: 0.9, signals: [] },
      { entityType: "adset", entityId: "b", entityName: "b", actionType: "scale_up", newBudget: 600, reason: "x", confidence: 0.6, signals: [] },
    ],
    [a, b],
    settings,
  );
  // 600+600 = 1200 > cap 1000 → ตัวที่มั่นใจน้อยกว่าถูกยกเลิก → 600+500 = 1100 ยังเกิน → ยกเลิกทั้งคู่
  const ups = out.filter((x) => x.actionType === "scale_up");
  assert.equal(ups.length, 0);
});

test("ad set ที่ไม่มีงบรายวัน (CBO) จะไม่ถูกปรับงบ", () => {
  const e = { ...adset("a", 0, 800, 20), dailyBudget: undefined };
  const out = applyGuardrails([{ entityType: "adset", entityId: "a", entityName: "a", actionType: "scale_up", newBudget: 500, reason: "x", confidence: 0.9, signals: [] }], [e], settings);
  assert.equal(out[0].actionType, "keep");
});

test("normalizeRow เลือกผลลัพธ์ตาม objective", () => {
  const row = {
    date_start: "2026-01-01", date_stop: "2026-01-01", spend: "1000", impressions: "20000", clicks: "300", reach: "9000",
    actions: [{ action_type: "omni_purchase", value: "10" }, { action_type: "lead", value: "3" }, { action_type: "link_click", value: "250" }],
    action_values: [{ action_type: "omni_purchase", value: "5000" }],
  };
  const sales = normalizeRow(row, "OUTCOME_SALES");
  assert.equal(sales.results, 10);
  assert.equal(sales.cpa, 100);
  assert.equal(sales.roas, 5);
  const leads = normalizeRow(row, "OUTCOME_LEADS");
  assert.equal(leads.results, 3);
  const traffic = normalizeRow(row, "OUTCOME_TRAFFIC");
  assert.equal(traffic.results, 250);
  assert.equal(Number(sales.ctr.toFixed(2)), 1.5);
});

test("sumMetrics คำนวณอัตราส่วนใหม่จากผลรวม", () => {
  const a = normalizeRow({ date_start: "", date_stop: "", spend: "100", impressions: "1000", clicks: "10", actions: [{ action_type: "omni_purchase", value: "1" }] }, "OUTCOME_SALES");
  const b = normalizeRow({ date_start: "", date_stop: "", spend: "300", impressions: "1000", clicks: "30", actions: [{ action_type: "omni_purchase", value: "3" }] }, "OUTCOME_SALES");
  const s = sumMetrics([a, b]);
  assert.equal(s.spend, 400);
  assert.equal(s.results, 4);
  assert.equal(s.cpa, 100);
  assert.equal(s.ctr, 2);
});

test("แปลงหน่วยเงิน minor units ตามสกุลเงิน", () => {
  assert.equal(toMinor(150.5, "THB"), 15050);
  assert.equal(fromMinor("15050", "THB"), 150.5);
  assert.equal(toMinor(1500, "JPY"), 1500);
});
