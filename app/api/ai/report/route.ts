import { handler, ok } from "@/lib/api";
import { buildReport } from "@/lib/ai/build-report";

export const POST = handler(async (req) => {
  const body = (await req.json().catch(() => ({}))) as { accountId?: string; type?: "daily" | "weekly" | "custom"; days?: number };
  const report = await buildReport(body.accountId, body.type || "weekly", body.days);
  return ok(report);
});
