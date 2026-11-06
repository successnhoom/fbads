import { z } from "zod";
import { handler, ok } from "@/lib/api";
import { requireAccount } from "@/lib/accounts";
import { prisma } from "@/lib/db";

const Schema = z.object({
  accountId: z.string().optional(),
  name: z.string().min(1),
  objective: z.enum(["OUTCOME_SALES", "OUTCOME_LEADS", "OUTCOME_ENGAGEMENT", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS", "OUTCOME_APP_PROMOTION"]),
  dailyBudget: z.number().positive().optional(),
  status: z.enum(["ACTIVE", "PAUSED"]).default("PAUSED"),
});

/** สร้างแคมเปญเปล่าอย่างเร็ว (ใส่ ad set/โฆษณาต่อใน Ads Manager หรือให้ AI วางแผน) */
export const POST = handler(async (req) => {
  const body = Schema.parse(await req.json());
  const { account, client } = await requireAccount(body.accountId);
  const r = await client.createCampaign(account.id, { name: body.name, objective: body.objective, dailyBudget: body.dailyBudget, currency: account.currency, status: body.status });
  await prisma.actionLog.create({
    data: { accountId: account.id, entityType: "campaign", entityId: r.id, entityName: body.name, actionType: "create", afterJson: JSON.stringify(body), reason: "สร้างแคมเปญจากแดชบอร์ด", status: "applied", appliedAt: new Date() },
  });
  return ok(r);
});
