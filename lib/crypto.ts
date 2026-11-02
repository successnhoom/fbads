import crypto from "crypto";

// เข้ารหัส access token ก่อนเก็บลงฐานข้อมูล (AES-256-GCM)
function key() {
  const secret = process.env.APP_SECRET_KEY;
  if (!secret || secret.length < 16) {
    throw new Error("APP_SECRET_KEY ต้องตั้งค่าและยาวอย่างน้อย 16 ตัวอักษร");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("รูปแบบ token ที่เข้ารหัสไม่ถูกต้อง");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
