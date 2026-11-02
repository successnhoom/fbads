import { handler, ok } from "@/lib/api";
import { requireAccount } from "@/lib/accounts";
import { PlanBriefSchema, generateCampaignPlan } from "@/lib/ai/planner";
import { prisma } from "@/lib/db";

export const GET = handler(async (req) => {
  const { account } = await requireAccount(new URL(req.url).searchParams.get("accountId"));
  const plans = await prisma.campaignPlan.findMany({ where: { accountId: account.id }, orderBy: { createdAt: "desc" }, take: 20 });
  return ok(plans);
});

export const POST = handler(async (req) => {
  const body = await req.json();
  const brief = PlanBriefSchema.parse(body);
  const { account } = await requireAccount(body.accountId);
  const plan = await generateCampaignPlan(brief, account.currency);
  const saved = await prisma.campaignPlan.create({ data: { accountId: account.id, brief: JSON.stringify(brief), planJson: JSON.stringify(plan) } });
  return ok({ id: saved.id, plan, brief });
});
