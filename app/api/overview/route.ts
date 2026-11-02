import { handler, ok } from "@/lib/api";
import { requireAccount } from "@/lib/accounts";
import { loadAccountSnapshot } from "@/lib/meta/data";

export const GET = handler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const days = Math.min(90, Math.max(1, Number(sp.get("days") || 7)));
  const { account, client } = await requireAccount(sp.get("accountId"));
  const snap = await loadAccountSnapshot(client, account.id, account.currency, days, {
    withAds: sp.get("ads") === "1",
    withBreakdowns: sp.get("breakdowns") === "1",
  });
  return ok({ account: { id: account.id, name: account.name, currency: account.currency }, snapshot: snap });
});
