import { handler, ok } from "@/lib/api";
import { requireAccount } from "@/lib/accounts";

/** เพจ / พิกเซล / custom audiences ที่ใช้ได้กับบัญชีที่เลือก */
export const GET = handler(async (req) => {
  const accountId = new URL(req.url).searchParams.get("accountId");
  const { account, client } = await requireAccount(accountId);
  const [pages, pixels, audiences] = await Promise.all([
    client.pages().catch(() => []),
    client.pixels(account.id).catch(() => []),
    client.customAudiences(account.id).catch(() => []),
  ]);
  return ok({ pages, pixels, audiences });
});
