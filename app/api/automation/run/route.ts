import { handler, ok } from "@/lib/api";
import { requireAccount } from "@/lib/accounts";
import { runOptimization } from "@/lib/automation/run";

// AI ใช้เวลาคิด 1-3 นาที – ขยายเวลาทำงานของฟังก์ชันบน serverless
export const maxDuration = 300;

/** รันรอบ optimize ทันที (จากปุ่มในหน้าเว็บ) */
export const POST = handler(async (req) => {
  const body = (await req.json().catch(() => ({}))) as { accountId?: string; useAI?: boolean };
  const { account } = await requireAccount(body.accountId);
  const summary = await runOptimization(account, { force: true, useAI: body.useAI });
  return ok(summary);
});
