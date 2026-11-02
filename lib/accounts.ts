import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { MetaClient } from "@/lib/meta/client";
import type { AdAccount, AutomationSettings } from "@prisma/client";

export async function listAccounts() {
  return prisma.adAccount.findMany({ orderBy: { createdAt: "asc" }, include: { settings: true } });
}

/** บัญชีที่เลือกใช้งานอยู่ (isActive) หรือบัญชีแรก */
export async function getActiveAccount(accountId?: string | null) {
  if (accountId) {
    const a = await prisma.adAccount.findUnique({ where: { id: accountId }, include: { settings: true } });
    if (a) return a;
  }
  const active = await prisma.adAccount.findFirst({ where: { isActive: true }, include: { settings: true } });
  if (active) return active;
  return prisma.adAccount.findFirst({ orderBy: { createdAt: "asc" }, include: { settings: true } });
}

export function clientFor(account: AdAccount) {
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
