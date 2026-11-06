import { ensureSchema, prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { MetaClient } from "@/lib/meta/client";
import { DEMO_ACCOUNT_ID, DemoMetaClient, isDemoMode } from "@/lib/meta/demo";
import type { AdAccount, AutomationSettings } from "@prisma/client";

/** โหมดสาธิต: สร้างบัญชีจำลองให้อัตโนมัติถ้ายังไม่มี */
async function ensureDemoAccount() {
  if (!isDemoMode()) return;
  const existing = await prisma.adAccount.findUnique({ where: { id: DEMO_ACCOUNT_ID } });
  if (existing) return;
  const anyActive = await prisma.adAccount.findFirst({ where: { isActive: true } });
  await prisma.adAccount.create({
    data: { id: DEMO_ACCOUNT_ID, name: "ร้านสาธิต (Demo)", currency: "THB", timezone: "Asia/Bangkok", accessTokenEnc: encrypt("demo-token"), businessName: "Demo Business", isActive: !anyActive, pageId: "page_demo", pixelId: "px_demo" },
  });
  await prisma.automationSettings.upsert({ where: { accountId: DEMO_ACCOUNT_ID }, update: {}, create: { accountId: DEMO_ACCOUNT_ID, targetCpa: 80, dailyBudgetCap: 2000 } });
}

export async function listAccounts() {
  await ensureSchema();
  await ensureDemoAccount();
  return prisma.adAccount.findMany({ orderBy: { createdAt: "asc" }, include: { settings: true } });
}

/** บัญชีที่เลือกใช้งานอยู่ (isActive) หรือบัญชีแรก */
export async function getActiveAccount(accountId?: string | null) {
  await ensureSchema();
  await ensureDemoAccount();
  if (accountId) {
    const a = await prisma.adAccount.findUnique({ where: { id: accountId }, include: { settings: true } });
    if (a) return a;
  }
  const active = await prisma.adAccount.findFirst({ where: { isActive: true }, include: { settings: true } });
  if (active) return active;
  return prisma.adAccount.findFirst({ orderBy: { createdAt: "asc" }, include: { settings: true } });
}

export function clientFor(account: AdAccount) {
  if (account.id === DEMO_ACCOUNT_ID) return new DemoMetaClient();
  return new MetaClient(decrypt(account.accessTokenEnc));
}

export async function requireAccount(accountId?: string | null) {
  const account = await getActiveAccount(accountId);
  if (!account) throw new Error("ยังไม่ได้เชื่อมต่อบัญชีโฆษณา ไปที่หน้า ตั้งค่า เพื่อเชื่อมต่อก่อน");
  return { account, client: clientFor(account), settings: account.settings ?? (await ensureSettings(account.id)) };
}

export async function ensureSettings(accountId: string): Promise<AutomationSettings> {
  return prisma.automationSettings.upsert({ where: { accountId }, update: {}, create: { accountId } });
}

/** บันทึก token + ดึงบัญชีโฆษณาทั้งหมดที่ token เข้าถึงได้ */
export async function connectWithToken(token: string, expiresInSec?: number) {
  await ensureSchema();
  const client = new MetaClient(token);
  const accounts = await client.adAccounts();
  if (!accounts.length) throw new Error("token นี้ไม่มีสิทธิ์เข้าถึงบัญชีโฆษณาใดเลย");
  const enc = encrypt(token);
  const expiresAt = expiresInSec ? new Date(Date.now() + expiresInSec * 1000) : null;
  const existingActive = await prisma.adAccount.findFirst({ where: { isActive: true } });
  for (const [i, a] of accounts.entries()) {
    await prisma.adAccount.upsert({
      where: { id: a.id },
      update: { name: a.name, currency: a.currency, timezone: a.timezone_name, accessTokenEnc: enc, tokenExpiresAt: expiresAt, businessName: a.business?.name },
      create: {
        id: a.id,
        name: a.name,
        currency: a.currency,
        timezone: a.timezone_name,
        accessTokenEnc: enc,
        tokenExpiresAt: expiresAt,
        businessName: a.business?.name,
        isActive: !existingActive && i === 0,
      },
    });
    await ensureSettings(a.id);
  }
  return accounts;
}

export async function setActiveAccount(id: string) {
  await prisma.$transaction([
    prisma.adAccount.updateMany({ data: { isActive: false } }),
    prisma.adAccount.update({ where: { id }, data: { isActive: true } }),
  ]);
}
