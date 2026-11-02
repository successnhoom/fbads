/**
 * กฎเชิงตัวเลข (pure functions – ทดสอบได้ ไม่เรียก API)
 * ใช้คัดกรอง ad set ก่อนส่งให้ AI ตัดสิน และใช้เป็น guardrail บังคับหลัง AI ตัดสิน
 */
import type { EntityWithMetrics } from "@/lib/meta/types";

export interface RuleSettings {
  dailyBudgetCap: number;
  targetCpa: number | null;
  targetRoas: number | null;
  maxChangePct: number;
  minSpendToJudge: number;
  minAdsetBudget: number;
  maxAdsetBudget: number;
  pauseWhenCpaOver: number | null; // ตัวคูณของ targetCpa
}

export type ActionType = "scale_up" | "scale_down" | "pause" | "resume" | "keep";

export interface ProposedAction {
  entityType: "adset" | "campaign";
  entityId: string;
  entityName: string;
  actionType: ActionType;
  currentBudget?: number;
  newBudget?: number;
  reason: string;
  confidence: number; // 0-1
  signals: string[];
}

export interface Signal {
  entityId: string;
  tags: string[];
  notes: string[];
}

/** วิเคราะห์สัญญาณเชิงตัวเลขของแต่ละ ad set */
export function analyzeSignals(e: EntityWithMetrics, s: RuleSettings): Signal {
  const m = e.metrics;
  const tags: string[] = [];
  const notes: string[] = [];

  if (m.spend < s.minSpendToJudge) {
    tags.push("learning");
    notes.push(`ใช้จ่ายเพียง ${m.spend.toFixed(0)} ยังไม่ถึงขั้นต่ำ ${s.minSpendToJudge} สำหรับตัดสิน`);
    return { entityId: e.id, tags, notes };
  }

  if (m.results === 0) {
    tags.push("no_results");
    notes.push("ใช้งบแล้วแต่ยังไม่มีผลลัพธ์");
  }

  if (s.targetCpa && m.cpa > 0) {
    const ratio = m.cpa / s.targetCpa;
    if (ratio <= 0.8) { tags.push("cpa_great"); notes.push(`CPA ${m.cpa.toFixed(0)} ต่ำกว่าเป้า ${s.targetCpa} มาก (${(ratio * 100).toFixed(0)}%)`); }
    else if (ratio <= 1.0) { tags.push("cpa_ok"); notes.push(`CPA ${m.cpa.toFixed(0)} อยู่ในเป้า`); }
    else if (ratio <= 1.3) { tags.push("cpa_high"); notes.push(`CPA ${m.cpa.toFixed(0)} สูงกว่าเป้า ${((ratio - 1) * 100).toFixed(0)}%`); }
    else { tags.push("cpa_bad"); notes.push(`CPA ${m.cpa.toFixed(0)} สูงกว่าเป้ามาก (${(ratio * 100).toFixed(0)}% ของเป้า)`); }
    if (s.pauseWhenCpaOver && ratio >= s.pauseWhenCpaOver) tags.push("cpa_over_limit");
  }

  if (s.targetRoas && m.spend > 0) {
    if (m.roas >= s.targetRoas * 1.2) { tags.push("roas_great"); notes.push(`ROAS ${m.roas.toFixed(2)} สูงกว่าเป้า ${s.targetRoas}`); }
    else if (m.roas >= s.targetRoas) { tags.push("roas_ok"); }
    else if (m.roas > 0) { tags.push("roas_low"); notes.push(`ROAS ${m.roas.toFixed(2)} ต่ำกว่าเป้า ${s.targetRoas}`); }
  }

  if (m.frequency >= 3.5) { tags.push("fatigue"); notes.push(`ความถี่ ${m.frequency.toFixed(1)} สูง เสี่ยงคนเบื่อโฆษณา`); }
  if (m.ctr > 0 && m.ctr < 0.6) { tags.push("ctr_low"); notes.push(`CTR ${m.ctr.toFixed(2)}% ต่ำ ครีเอทีฟอาจไม่ดึงดูด`); }
  if (m.ctr >= 2) tags.push("ctr_high");

  if (e.prevMetrics && e.prevMetrics.results > 0 && m.results > 0) {
    const cpaChange = (m.cpa - e.prevMetrics.cpa) / e.prevMetrics.cpa;
    if (cpaChange > 0.3) { tags.push("cpa_rising"); notes.push(`CPA แย่ลง ${(cpaChange * 100).toFixed(0)}% เทียบช่วงก่อน`); }
    if (cpaChange < -0.2) { tags.push("cpa_improving"); notes.push(`CPA ดีขึ้น ${(-cpaChange * 100).toFixed(0)}% เทียบช่วงก่อน`); }
  }

  return { entityId: e.id, tags, notes };
}

/** กฎเสนอ action เบื้องต้น (AI จะนำไปพิจารณาต่อ) */
export function ruleBasedProposal(e: EntityWithMetrics, s: RuleSettings, signal: Signal): ProposedAction {
  const budget = e.dailyBudget ?? 0;
  const base: ProposedAction = {
    entityType: "adset",
    entityId: e.id,
    entityName: e.name,
    actionType: "keep",
    currentBudget: budget,
    newBudget: budget,
    reason: signal.notes.join(" / ") || "ตัวเลขอยู่ในเกณฑ์ปกติ",
    confidence: 0.5,
    signals: signal.tags,
  };
  const t = new Set(signal.tags);
  if (t.has("learning")) return { ...base, confidence: 0.9, reason: signal.notes[0] };

  const isPaused = (e.effectiveStatus || e.status || "").toUpperCase() !== "ACTIVE";
  if (t.has("cpa_over_limit") || (t.has("no_results") && e.metrics.spend >= s.minSpendToJudge * 2)) {
    return { ...base, actionType: isPaused ? "keep" : "pause", confidence: 0.85 };
  }
  if ((t.has("cpa_great") || t.has("roas_great")) && !t.has("fatigue") && !t.has("cpa_rising")) {
    return { ...base, actionType: "scale_up", newBudget: clampBudget(budget * (1 + s.maxChangePct / 100), s), confidence: 0.8 };
  }
  if (t.has("cpa_bad") || t.has("roas_low") || t.has("cpa_rising") || t.has("fatigue")) {
    return { ...base, actionType: "scale_down", newBudget: clampBudget(budget * (1 - s.maxChangePct / 100), s), confidence: 0.7 };
  }
  return base;
}

export function clampBudget(b: number, s: RuleSettings) {
  return Math.max(s.minAdsetBudget, Math.min(s.maxAdsetBudget, Math.round(b)));
}

/**
 * Guardrails – บังคับใช้กับทุก action ไม่ว่า AI จะเสนออะไร:
 * 1) ปรับได้ไม่เกิน maxChangePct ต่อรอบ 2) อยู่ในช่วง min/max 3) งบรวมไม่เกิน dailyBudgetCap
 */
export function applyGuardrails(actions: ProposedAction[], entities: EntityWithMetrics[], s: RuleSettings): ProposedAction[] {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const out: ProposedAction[] = [];
  for (const a of actions) {
    const e = byId.get(a.entityId);
    if (!e) continue;
    const cur = e.dailyBudget ?? 0;
    const copy: ProposedAction = { ...a, currentBudget: cur };
    if (a.actionType === "scale_up" || a.actionType === "scale_down") {
      if (!cur) { out.push({ ...copy, actionType: "keep", reason: `${a.reason} (ข้าม: ad set นี้ไม่ได้ตั้งงบรายวันเอง อาจใช้งบระดับแคมเปญ)` }); continue; }
      const maxUp = cur * (1 + s.maxChangePct / 100);
      const maxDown = cur * (1 - s.maxChangePct / 100);
      let nb = a.newBudget ?? cur;
      if (a.actionType === "scale_up") nb = Math.min(nb, maxUp);
      if (a.actionType === "scale_down") nb = Math.max(nb, maxDown);
      nb = clampBudget(nb, s);
      if (Math.abs(nb - cur) < 1) { out.push({ ...copy, actionType: "keep", newBudget: cur, reason: `${a.reason} (ไม่เปลี่ยน: ติดเพดาน guardrail)` }); continue; }
      copy.newBudget = nb;
    }
    out.push(copy);
  }

  // งบรวมหลังปรับต้องไม่เกิน cap – ถ้าเกิน ตัด scale_up ที่ confidence ต่ำสุดออกก่อน
  const budgetAfter = () =>
    entities.reduce((sum, e) => {
      const a = out.find((x) => x.entityId === e.id);
      if (a?.actionType === "pause") return sum;
      if (a && (a.actionType === "scale_up" || a.actionType === "scale_down")) return sum + (a.newBudget ?? 0);
      const active = (e.effectiveStatus || e.status || "").toUpperCase() === "ACTIVE";
      return sum + (active || a?.actionType === "resume" ? e.dailyBudget ?? 0 : 0);
    }, 0);

  let guard = 0;
  while (budgetAfter() > s.dailyBudgetCap && guard++ < 50) {
    const ups = out.filter((a) => a.actionType === "scale_up").sort((a, b) => a.confidence - b.confidence);
    if (!ups.length) break;
    const victim = ups[0];
    victim.actionType = "keep";
    victim.newBudget = victim.currentBudget;
    victim.reason += ` (ยกเลิกการเพิ่มงบ: งบรวมจะเกินเพดาน ${s.dailyBudgetCap})`;
  }
  return out;
}

export function settingsFromDb(s: {
  dailyBudgetCap: number; targetCpa: number | null; targetRoas: number | null; maxChangePct: number;
  minSpendToJudge: number; minAdsetBudget: number; maxAdsetBudget: number; pauseWhenCpaOver: number | null;
}): RuleSettings {
  return {
    dailyBudgetCap: s.dailyBudgetCap, targetCpa: s.targetCpa, targetRoas: s.targetRoas, maxChangePct: s.maxChangePct,
    minSpendToJudge: s.minSpendToJudge, minAdsetBudget: s.minAdsetBudget, maxAdsetBudget: s.maxAdsetBudget, pauseWhenCpaOver: s.pauseWhenCpaOver,
  };
}
