import { NextResponse } from "next/server";
import crypto from "crypto";
import { oauthUrl } from "@/lib/meta/client";
import { fail } from "@/lib/api";

export async function GET() {
  try {
    const state = crypto.randomBytes(16).toString("hex");
    const res = NextResponse.redirect(oauthUrl(state));
    res.cookies.set("fb_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/" });
    return res;
  } catch (e) {
    return fail(e, 400);
  }
}
