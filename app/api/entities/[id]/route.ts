import { handler, ok } from "@/lib/api";
import { requireAccount } from "@/lib/accounts";
import { prisma } from "@/lib/db";

/** แก้สถานะ / งบ / ชื่อ ของ campaign, ad set, ad ด้วยมือ */
export const POST = handler<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const body = (await req.json()) as { accountId?: string; status?: "ACTIVE" | "PAUSED"; dailyBudget?: number; name?: string; newName?: string; entityType?: string };
  const { account, client } = await requireAccount(body.accountId);
  const results: Record<string, unknown> = {};
  if (body.status) results.status = await client.updateStatus(id, body.status);
  if (body.dailyBudget) results.budget = await client.updateDailyBudget(id, body.dailyBudget, account.currency);
  if (body.newName) results.name = await client.updateName(id, body.newName);
  await prisma.actionLog.create({
    data: {
      accountId: account.id,
      entityType: body.entityType || "adset",
      entityId: id,
      entityName: body.name || id,
      actionType: body.status ? (body.status === "PAUSED" ? "pause" : "resume") : body.dailyBudget ? "update_budget" : "rename",
      afterJson: JSON.stringify({ status: body.status, dailyBudget: body.dailyBudget, name: body.newName }),
      reason: "ปรับด้วยมือจากหน้าเว็บ",
      status: "applied",
      appliedAt: new Date(),
    },
  });
  return ok(results);
});

/** ลบ campaign / ad set / ad */
export const DELETE = handler<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const { account, client } = await requireAccount(sp.get("accountId"));
  const r = await client.deleteEntity(id);
  await prisma.actionLog.create({
    data: {
      accountId: account.id,
      entityType: sp.get("entityType") || "campaign",
      entityId: id,
      entityName: sp.get("name") || id,
      actionType: "delete",
      reason: "ลบด้วยมือจากหน้าเว็บ",
      status: "applied",
      appliedAt: new Date(),
    },
  });
  return ok(r);
});
