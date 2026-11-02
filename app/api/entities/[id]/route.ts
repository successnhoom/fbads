import { handler, ok } from "@/lib/api";
import { requireAccount } from "@/lib/accounts";
import { prisma } from "@/lib/db";

/** แก้สถานะ / งบ ของ campaign, ad set, ad ด้วยมือ */
export const POST = handler<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const body = (await req.json()) as { accountId?: string; status?: "ACTIVE" | "PAUSED"; dailyBudget?: number; name?: string; entityType?: string };
  const { account, client } = await requireAccount(body.accountId);
  const results: Record<string, unknown> = {};
  if (body.status) results.status = await client.updateStatus(id, body.status);
  if (body.dailyBudget) results.budget = await client.updateDailyBudget(id, body.dailyBudget, account.currency);
  await prisma.actionLog.create({
    data: {
      accountId: account.id,
      entityType: body.entityType || "adset",
      entityId: id,
      entityName: body.name || id,
      actionType: body.status ? (body.status === "PAUSED" ? "pause" : "resume") : "update_budget",
      afterJson: JSON.stringify({ status: body.status, dailyBudget: body.dailyBudget }),
      reason: "ปรับด้วยมือจากหน้าเว็บ",
      status: "applied",
      appliedAt: new Date(),
    },
  });
  return ok(results);
});
