import { handler, ok } from "@/lib/api";
import { connectWithToken } from "@/lib/accounts";

/** เชื่อมต่อด้วย access token ตรง ๆ (System User token / long-lived token) */
export const POST = handler(async (req) => {
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = body.token?.trim() || process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("กรุณาใส่ access token หรือตั้งค่า META_ACCESS_TOKEN");
  const accounts = await connectWithToken(token);
  return ok({ count: accounts.length, accounts: accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency })) });
});
