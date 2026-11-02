import { prisma } from "@/lib/db";
import { clientFor, ensureSettings } from "@/lib/accounts";
import { loadAccountSnapshot } from "@/lib/meta/data";
import { optimizeAdsets } from "@/lib/ai/optimizer";
import { settingsFromDb, type ProposedAction } from "./rules";
import type { AdAccount } from "@prisma/client";
import type { MetaClient } from "@/lib/meta/client";

export interface RunSummary {
  runId: string;
  accountId: string;
  mode: string;
  assessment: string;
  proposed: number;
  applied: number;
  pending: number;
  failed: number;
  actions: ProposedAction[];
  watchlist: string[];
  creativeNotes: string[];
}

/** รันรอบ optimize หนึ่งครั้งสำหรับบัญชี: วิเคราะห์ → บันทึก action → ทำทันที (auto) หรือรออนุมัติ */
export async function runOptimization(account: AdAccount, opts: { force?: boolean; useAI?: boolean } = {}): Promise<RunSummary> {
  const settings = await ensureSettings(account.id);
  if (!settings.enabled && !opts.force) {
    return { runId: "", accountId: account.id, mode: settings.mode, assessment: "ออโต้เมชันปิดอยู่", proposed: 0, applied: 0, pending: 0, failed: 0, actions: [], watchlist: [], creativeNotes: [] };
  }
  const client = clientFor(account);
  const snap = await loadAccountSnapshot(client, account.id, account.currency, settings.lookbackDays);
  const result = await optimizeAdsets(snap.adsets, settingsFromDb(settings), { currency: account.currency, lookbackDays: settings.lookbackDays, useAI: opts.useAI });
  const runId = `run_${Date.now()}`;

  // เก็บ snapshot รายวันไว้ดูเทรนด์
  await prisma.insightSnapshot.upsert({
    where: { accountId_date_level_entityId: { accountId: account.id, date: snap.until, level: "account", entityId: account.id } },
    update: { dataJson: JSON.stringify(snap.account.metrics) },
    create: { accountId: account.id, date: snap.until, level: "account", entityId: account.id, dataJson: JSON.stringify(snap.account.metrics) },
  });

  const actionable = result.actions.filter((a) => a.actionType !== "keep");
  let applied = 0, pending = 0, failed = 0;

  for (const a of actionable) {
    const log = await prisma.actionLog.create({
      data: {
        accountId: account.id,
        runId,
        entityType: a.entityType,
        entityId: a.entityId,
        entityName: a.entityName,
        actionType: a.actionType,
        beforeJson: JSON.stringify({ dailyBudget: a.currentBudget }),
        afterJson: JSON.stringify({ dailyBudget: a.newBudget }),
        reason: a.reason,
        confidence: a.confidence,
        status: settings.mode === "auto" ? "applied" : "pending",
      },
    });
    if (settings.mode === "auto") {
      try {
        await applyAction(client, account.currency, a);
        await prisma.actionLog.update({ where: { id: log.id }, data: { status: "applied", appliedAt: new Date() } });
        applied++;
      } catch (e) {
        await prisma.actionLog.update({ where: { id: log.id }, data: { status: "failed", error: (e as Error).message } });
        failed++;
      }
    } else pending++;
  }

  // บันทึก "keep" แบบย่อไว้ด้วย เพื่อให้ดูย้อนหลังได้ว่า AI ตัดสินอะไร
  for (const a of result.actions.filter((x) => x.actionType === "keep")) {
    await prisma.actionLog.create({
      data: { accountId: account.id, runId, entityType: a.entityType, entityId: a.entityId, entityName: a.entityName, actionType: "keep", reason: a.reason, confidence: a.confidence, status: "skipped" },
    });
  }

  const summary: RunSummary = { runId, accountId: account.id, mode: settings.mode, assessment: result.assessment, proposed: actionable.length, applied, pending, failed, actions: result.actions, watchlist: result.watchlist, creativeNotes: result.creativeNotes };
  if (settings.notifyWebhookUrl) await notify(settings.notifyWebhookUrl, account.name, summary).catch(() => undefined);
  return summary;
}

export async function applyAction(client: MetaClient, currency: string, a: { entityId: string; actionType: string; newBudget?: number | null }) {
  switch (a.actionType) {
    case "pause":
      return client.updateStatus(a.entityId, "PAUSED");
    case "resume":
      return client.updateStatus(a.entityId, "ACTIVE");
    case "scale_up":
    case "scale_down":
      if (!a.newBudget) throw new Error("ไม่มีงบใหม่");
      return client.updateDailyBudget(a.entityId, a.newBudget, currency);
    default:
      return { success: true };
  }
}

/** อนุมัติ action ที่รออยู่ แล้วทำจริง */
export async function approveAction(id: string) {
  const log = await prisma.actionLog.findUnique({ where: { id }, include: { account: true } });
  if (!log) throw new Error("ไม่พบ action");
  if (log.status !== "pending") throw new Error("action นี้ไม่ได้อยู่ในสถานะรออนุมัติ");
  const after = log.afterJson ? (JSON.parse(log.afterJson) as { dailyBudget?: number }) : {};
  try {
    await applyAction(clientFor(log.account), log.account.currency, { entityId: log.entityId, actionType: log.actionType, newBudget: after.dailyBudget });
    return prisma.actionLog.update({ where: { id }, data: { status: "applied", appliedAt: new Date() } });
  } catch (e) {
    return prisma.actionLog.update({ where: { id }, data: { status: "failed", error: (e as Error).message } });
  }
}

async function notify(url: string, accountName: string, s: RunSummary) {
  const lines = [
    `🤖 AI Ads Expert – ${accountName}`,
    s.assessment,
    `เสนอ ${s.proposed} รายการ | ทำแล้ว ${s.applied} | รออนุมัติ ${s.pending} | ล้มเหลว ${s.failed}`,
    ...s.actions.filter((a) => a.actionType !== "keep").map((a) => `• ${labelAction(a.actionType)} ${a.entityName}${a.newBudget && a.currentBudget !== a.newBudget ? ` (${a.currentBudget} → ${a.newBudget})` : ""}: ${a.reason}`),
  ];
  const text = lines.join("\n");
  // รองรับ webhook ทั่วไป (Discord/Slack/Make/n8n/LINE Messaging ผ่าน relay) – ส่งทั้ง text และ content
  await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, content: text, summary: s }) });
}

export function labelAction(t: string) {
  return ({ scale_up: "เพิ่มงบ", scale_down: "ลดงบ", pause: "หยุด", resume: "เปิด", keep: "คงเดิม", create: "สร้าง" } as Record<string, string>)[t] || t;
}
