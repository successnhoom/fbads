/**
 * ระบบล็อกอินแบบรหัสผ่านเดียว (APP_PASSWORD) – ใช้ได้ทั้งใน middleware (edge) และ route (node)
 * cookie เก็บค่า HMAC ของรหัสผ่าน ไม่ได้เก็บรหัสผ่านจริง
 */
export const SESSION_COOKIE = "aiads_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 วัน

export function authEnabled() {
  return !!process.env.APP_PASSWORD;
}

async function hmac(message: string, secret: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** ค่า cookie ที่ถูกต้อง – เปลี่ยน APP_PASSWORD แล้วทุก session เดิมจะหลุดอัตโนมัติ */
export async function expectedSessionValue() {
  const password = process.env.APP_PASSWORD || "";
  const secret = process.env.APP_SECRET_KEY || "aiads-session";
  return hmac(`session:${password}`, secret);
}

/** เทียบแบบเวลาคงที่ กันการเดาทีละตัวอักษร */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
