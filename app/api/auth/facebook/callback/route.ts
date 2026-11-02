import { NextResponse } from "next/server";
import { exchangeCodeForLongLivedToken } from "@/lib/meta/client";
import { connectWithToken } from "@/lib/accounts";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.headers.get("cookie")?.match(/fb_oauth_state=([a-f0-9]+)/)?.[1];
  const base = process.env.APP_URL || url.origin;
  const back = (msg: string, okFlag = false) => NextResponse.redirect(`${base}/settings?${okFlag ? "connected" : "error"}=${encodeURIComponent(msg)}`);
  if (!code) return back(url.searchParams.get("error_description") || "ไม่ได้รับ code จาก Facebook");
  if (!state || state !== cookieState) return back("state ไม่ตรงกัน กรุณาลองใหม่");
  try {
    const { token, expiresIn } = await exchangeCodeForLongLivedToken(code);
    const accounts = await connectWithToken(token, expiresIn);
    return back(`เชื่อมต่อสำเร็จ ${accounts.length} บัญชี`, true);
  } catch (e) {
    return back((e as Error).message);
  }
}
