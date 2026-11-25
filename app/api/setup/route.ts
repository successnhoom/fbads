import { handler, ok } from "@/lib/api";
import { dbInfo, ensureSchema, prisma } from "@/lib/db";
import { isDemoMode, realAccountBlocker } from "@/lib/env";
import { authEnabled } from "@/lib/session";
import { DEMO_ACCOUNT_ID } from "@/lib/meta/demo";

/** สถานะความพร้อมใช้งานจริง (ไม่เปิดเผยค่า secret ใด ๆ – บอกแค่ว่าตั้งแล้วหรือยัง) */
export const GET = handler(async () => {
  await ensureSchema();
  const realAccounts = await prisma.adAccount.count({ where: { id: { not: DEMO_ACCOUNT_ID } } });
  return ok({
    demo: isDemoMode(),
    auth: authEnabled(),
    db: dbInfo(),
    ai: !!process.env.ANTHROPIC_API_KEY,
    secretKey: !!process.env.APP_SECRET_KEY,
    cron: !!process.env.CRON_SECRET,
    metaApp: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
    metaToken: !!process.env.META_ACCESS_TOKEN,
    realAccounts,
    blocker: realAccountBlocker(),
    hosted: process.env.VERCEL === "1",
  });
});
