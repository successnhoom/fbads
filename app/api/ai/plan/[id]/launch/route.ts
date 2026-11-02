import { handler, ok } from "@/lib/api";
import { requireAccount } from "@/lib/accounts";
import { CampaignPlanSchema, launchPlan, PlanBriefSchema } from "@/lib/ai/planner";
import { prisma } from "@/lib/db";

export const POST = handler<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { status?: "ACTIVE" | "PAUSED"; plan?: unknown; pageId?: string; pixelId?: string };
  const saved = await prisma.campaignPlan.findUnique({ where: { id }, include: { account: true } });
  if (!saved) throw new Error("ไม่พบแผน");
  const { account, client } = await requireAccount(saved.accountId);
  const pageId = body.pageId || account.pageId;
  if (!pageId) throw new Error("กรุณาเลือกเพจ Facebook ในหน้า ตั้งค่า ก่อนสร้างแคมเปญ");
  const plan = CampaignPlanSchema.parse(body.plan ?? JSON.parse(saved.planJson));
  const brief = PlanBriefSchema.parse(JSON.parse(saved.brief));
  try {
    const result = await launchPlan(client, { accountId: account.id, currency: account.currency, plan, brief, pageId, pixelId: body.pixelId || account.pixelId, status: body.status || "PAUSED" });
    await prisma.campaignPlan.update({ where: { id }, data: { status: "launched", launchedIds: JSON.stringify(result), planJson: JSON.stringify(plan) } });
    await prisma.actionLog.create({
      data: { accountId: account.id, entityType: "campaign", entityId: result.campaignId, entityName: plan.campaign_name, actionType: "create", afterJson: JSON.stringify(result), reason: "AI สร้างแคมเปญจากแผน", status: "applied", appliedAt: new Date() },
    });
    return ok(result);
  } catch (e) {
    await prisma.campaignPlan.update({ where: { id }, data: { status: "failed" } });
    throw e;
  }
});
