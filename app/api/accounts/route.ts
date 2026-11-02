import { handler, ok } from "@/lib/api";
import { listAccounts } from "@/lib/accounts";
import { prisma } from "@/lib/db";

export const GET = handler(async () => {
  const accounts = await listAccounts();
  return ok(
    accounts.map((a) => ({
      id: a.id, name: a.name, currency: a.currency, timezone: a.timezone, isActive: a.isActive, pageId: a.pageId, pixelId: a.pixelId,
      businessName: a.businessName, tokenExpiresAt: a.tokenExpiresAt, automationEnabled: a.settings?.enabled ?? false,
    })),
  );
});

export const PATCH = handler(async (req) => {
  const body = (await req.json()) as { id: string; pageId?: string | null; pixelId?: string | null };
  const a = await prisma.adAccount.update({ where: { id: body.id }, data: { pageId: body.pageId ?? undefined, pixelId: body.pixelId ?? undefined } });
  return ok({ id: a.id, pageId: a.pageId, pixelId: a.pixelId });
});

export const DELETE = handler(async (req) => {
  const { id } = (await req.json()) as { id: string };
  await prisma.adAccount.delete({ where: { id } });
  return ok({ deleted: id });
});
