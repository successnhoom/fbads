import { PrismaClient } from "@prisma/client";
import { SCHEMA_SQL } from "./schema-sql";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaReady?: Promise<void> };

// ค่าเริ่มต้นสำหรับ serverless: ถ้าไม่ได้ตั้ง DATABASE_URL ใช้ SQLite ใน /tmp (ข้อมูลหายเมื่อ instance ใหม่)
if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.VERCEL ? "file:/tmp/app.db" : "file:./dev.db";

/** ฐานข้อมูลเก็บข้อมูลถาวรหรือไม่ (SQLite ใน /tmp บน serverless = ไม่ถาวร) */
export function dbInfo() {
  const url = process.env.DATABASE_URL || "";
  const kind = /^postgres(ql)?:\/\//.test(url) ? "postgres" : url.startsWith("file:") ? "sqlite" : "other";
  const persistent = kind === "postgres" || (kind === "sqlite" && !url.startsWith("file:/tmp"));
  return { kind, persistent };
}

function create() {
  return new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
}

export const prisma = globalForPrisma.prisma ?? create();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * บน serverless (Vercel) ที่ใช้ SQLite ใน /tmp ไฟล์จะว่างเปล่าตอน cold start
 * ฟังก์ชันนี้สร้างตารางให้อัตโนมัติถ้ายังไม่มี (รันครั้งเดียวต่อ process)
 */
export function ensureSchema(): Promise<void> {
  if (!globalForPrisma.prismaReady) {
    globalForPrisma.prismaReady = (async () => {
      if (!(process.env.DATABASE_URL || "").startsWith("file:")) return;
      try {
        const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>("SELECT name FROM sqlite_master WHERE type='table' AND name='AdAccount'");
        if (rows.length) return;
        const statements = SCHEMA_SQL.split("\n")
          .filter((line) => !line.trim().startsWith("--"))
          .join("\n")
          .split(";")
          .map((x) => x.trim())
          .filter((x) => /^CREATE/i.test(x));
        for (const stmt of statements) await prisma.$executeRawUnsafe(stmt);
      } catch (e) {
        console.error("[db] ensureSchema failed", e);
        globalForPrisma.prismaReady = undefined;
        throw e;
      }
    })();
  }
  return globalForPrisma.prismaReady;
}
