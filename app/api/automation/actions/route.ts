import { handler, ok } from "@/lib/api";
import { requireAccount } from "@/lib/accounts";
import { prisma } from "@/lib/db";

export const GET = handler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const { account } = await requireAccount(sp.get("accountId"));
  const status = sp.get("status");
  const list = await prisma.actionLog.findMany({
    where: { accountId: account.id, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: Number(sp.get("limit") || 100),
  });
  return ok(list);
});
