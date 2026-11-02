import { handler, ok } from "@/lib/api";
import { prisma } from "@/lib/db";

export const GET = handler<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const r = await prisma.report.findUnique({ where: { id } });
  if (!r) throw new Error("ไม่พบรายงาน");
  return ok(r);
});

export const DELETE = handler<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  await prisma.report.delete({ where: { id } });
  return ok({ id });
});
