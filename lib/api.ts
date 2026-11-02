import { NextResponse } from "next/server";
import { MetaApiError } from "@/lib/meta/client";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(e: unknown, status = 500) {
  const err = e as Error;
  let message = err?.message || "เกิดข้อผิดพลาด";
  if (e instanceof MetaApiError) {
    message = `Meta API: ${e.userMessage || e.message}${e.code ? ` (code ${e.code})` : ""}`;
    if (e.code === 190) message += " – token หมดอายุหรือไม่ถูกต้อง กรุณาเชื่อมต่อใหม่";
    status = e.status >= 400 && e.status < 600 ? e.status : 502;
  }
  console.error("[api]", err);
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** ครอบ handler ให้จับ error เป็น JSON เสมอ */
export function handler<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      return fail(e);
    }
  };
}

export function requireCronAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("ยังไม่ได้ตั้งค่า CRON_SECRET");
  const url = new URL(req.url);
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || url.searchParams.get("secret");
  if (given !== secret) {
    const err = new Error("unauthorized");
    (err as Error & { status: number }).status = 401;
    throw err;
  }
}
