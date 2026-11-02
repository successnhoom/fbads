import { handler, ok } from "@/lib/api";
import { approveAction } from "@/lib/automation/run";
import { prisma } from "@/lib/db";

export const POST = handler<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { decision } = (await req.json()) as { decision: "approve" | "reject" };
  if (decision === "approve") return ok(await approveAction(id));
  return ok(await prisma.actionLog.update({ where: { id }, data: { status: "rejected" } }));
});
