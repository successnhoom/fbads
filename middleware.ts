import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authEnabled, expectedSessionValue, safeEqual } from "@/lib/session";
import { isDemoMode, realAccountBlocker } from "@/lib/env";

// เส้นทางที่เข้าได้โดยไม่ต้องล็อกอิน
const PUBLIC = ["/login", "/api/auth/login", "/api/cron/"];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // เว็บออนไลน์ที่ปิดโหมดสาธิตแล้วแต่ยังไม่ตั้งรหัสผ่าน → ล็อกทั้งเว็บ
  if (!authEnabled() && !isDemoMode()) {
    const blocker = realAccountBlocker();
    if (blocker && !pathname.startsWith("/api/cron/")) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ ok: false, error: blocker }, { status: 503 });
      return new NextResponse(`<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;background:#0b0d17;color:#e7e9f3;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px"><div style="max-width:520px"><h1>เว็บถูกล็อกไว้เพื่อความปลอดภัย</h1><p>${blocker}</p><p>ไปที่ Vercel → Settings → Environment Variables แล้วกด Redeploy</p></div>`, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
    }
  }
  if (!authEnabled()) return NextResponse.next();
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();

  const cookie = req.cookies.get(SESSION_COOKIE)?.value || "";
  if (cookie && safeEqual(cookie, await expectedSessionValue())) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
