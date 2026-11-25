import { handler, ok } from "@/lib/api";
import { buildReport } from "@/lib/ai/build-report";

// AI ใช้เวลาคิด 1-3 นาที – ขยายเวลาทำงานของฟังก์ชันบน serverless
export const maxDuration = 300;

export const POST = handler(async (req) => {
  const body = (await req.json().catch(() => ({}))) as { accountId?: string; type?: "daily" | "weekly" | "custom"; days?: number };
  const report = await buildReport(body.accountId, body.type || "weekly", body.days);
  return ok(report);
});
