import { handler, ok } from "@/lib/api";
import { requireAccount } from "@/lib/accounts";
import { prisma } from "@/lib/db";
import { z } from "zod";

const Schema = z.object({
  enabled: z.boolean().optional(),
  mode: z.enum(["auto", "approve"]).optional(),
  dailyBudgetCap: z.number().positive().optional(),
  targetCpa: z.number().positive().nullable().optional(),
  targetRoas: z.number().positive().nullable().optional(),
  maxChangePct: z.number().int().min(5).max(50).optional(),
  minSpendToJudge: z.number().min(0).optional(),
  minAdsetBudget: z.number().min(1).optional(),
  maxAdsetBudget: z.number().min(1).optional(),
  lookbackDays: z.number().int().min(1).max(30).optional(),
  pauseWhenCpaOver: z.number().min(1).nullable().optional(),
  notifyWebhookUrl: z.string().url().nullable().optional().or(z.literal("")),
});

export const GET = handler(async (req) => {
  const { settings } = await requireAccount(new URL(req.url).searchParams.get("accountId"));
  return ok(settings);
});

export const PUT = handler(async (req) => {
  const body = await req.json();
  const { account } = await requireAccount(body.accountId);
  const data = Schema.parse(body);
  if (data.notifyWebhookUrl === "") data.notifyWebhookUrl = null;
  const updated = await prisma.automationSettings.update({ where: { accountId: account.id }, data });
  return ok(updated);
});
