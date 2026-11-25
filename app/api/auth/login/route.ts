import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, authEnabled, expectedSessionValue, safeEqual } from "@/lib/session";

// จำกัดการเดารหัส: ช้าลงเล็กน้อยทุกครั้งที่ผิด
const failures = new Map<string, { count: number; until: number }>();

export async function POST(req: Request) {
  if (!authEnabled()) return NextResponse.json({ ok: true, data: { auth: false } });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const f = failures.get(ip);
  if (f && f.until > Date.now()) {
    return NextResponse.json({ ok: false, error: `ลองผิดหลายครั้ง กรุณารอ ${Math.ceil((f.until - Date.now()) / 1000)} วินาที` }, { status: 429 });
  }
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password || !safeEqual(password, process.env.APP_PASSWORD || "")) {
    const count = (f?.count || 0) + 1;
    failures.set(ip, { count, until: count >= 5 ? Date.now() + Math.min(300, 15 * 2 ** (count - 5)) * 1000 : 0 });
    return NextResponse.json({ ok: false, error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }
  failures.delete(ip);
  const res = NextResponse.json({ ok: true, data: { auth: true } });
  res.cookies.set(SESSION_COOKIE, await expectedSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
