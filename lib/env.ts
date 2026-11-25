/** ตัวช่วยอ่านสถานะการตั้งค่าจาก env – ไม่มี import หนัก ใช้ได้ทั้ง edge และ node */

export const isHosted = () => process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

/** โหมดสาธิต: DEMO_MODE=1 หรือรันบน Vercel โดยยังไม่ได้ตั้ง DEMO_MODE และยังไม่มี META_ACCESS_TOKEN */
export const isDemoMode = () =>
  process.env.DEMO_MODE === "1" ||
  process.env.DEMO_MODE === "true" ||
  (process.env.DEMO_MODE === undefined && process.env.VERCEL === "1" && !process.env.META_ACCESS_TOKEN);

/**
 * เว็บที่ออนไลน์และต่อบัญชีจริง ต้องมีรหัสผ่านเสมอ
 * คืนข้อความอธิบายถ้ายังไม่ปลอดภัยพอจะเชื่อมบัญชีจริง
 */
export function realAccountBlocker(): string | null {
  if (process.env.VERCEL !== "1") return null; // รันในเครื่องตัวเอง ไม่บังคับ
  if (!process.env.APP_PASSWORD) return "ต้องตั้ง APP_PASSWORD (รหัสเข้าเว็บ) ใน Environment Variables ก่อนเชื่อมบัญชีโฆษณาจริง เพื่อไม่ให้คนอื่นที่มีลิงก์เข้ามาปรับโฆษณาได้";
  if (!process.env.APP_SECRET_KEY) return "ต้องตั้ง APP_SECRET_KEY (คีย์เข้ารหัส token) ใน Environment Variables ก่อนเชื่อมบัญชีโฆษณาจริง";
  return null;
}
