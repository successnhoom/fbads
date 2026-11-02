import { handler, ok } from "@/lib/api";
import { requireAccount } from "@/lib/accounts";
import { prisma } from "@/lib/db";

export const GET = handler(async (req) => {
  const { account } = await requireAccount(new URL(req.url).searchParams.get("accountId"));
  const list = await prisma.report.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, type: true, title: true, periodFrom: true, periodTo: true, createdAt: true, metricsJson: true },
  });
  return ok(list);
});
