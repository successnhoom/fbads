import { handler, ok } from "@/lib/api";
import { requireAccount } from "@/lib/accounts";
import { prisma } from "@/lib/db";

export const GET = handler(async (req) => {
  const { account } = await requireAccount(new URL(req.url).searchParams.get("accountId"));
  const list = await prisma.audienceSuggestion.findMany({ where: { accountId: account.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return ok(list);
});

export const DELETE = handler(async (req) => {
  const { id } = (await req.json()) as { id: string };
  await prisma.audienceSuggestion.delete({ where: { id } });
  return ok({ id });
});
