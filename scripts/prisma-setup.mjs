/**
 * รันก่อน next build: เลือก schema ตามชนิดฐานข้อมูล
 * - DATABASE_URL (หรือ POSTGRES_PRISMA_URL) เป็น postgres:// → ใช้ prisma/schema.postgres.prisma แล้ว db push สร้างตาราง
 * - นอกนั้น → SQLite (prisma/schema.prisma)
 */
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || "";
const isPg = /^postgres(ql)?:\/\//.test(url);
const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });

if (isPg) {
  console.log("[prisma-setup] PostgreSQL detected → generate + db push");
  const env = { DATABASE_URL: url };
  run("npx prisma generate --schema prisma/schema.postgres.prisma", env);
  run("npx prisma db push --skip-generate --schema prisma/schema.postgres.prisma", env);
} else {
  console.log("[prisma-setup] SQLite → generate");
  run("npx prisma generate --schema prisma/schema.prisma");
}
