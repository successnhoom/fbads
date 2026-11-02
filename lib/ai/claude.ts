import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export const AI_MODEL = process.env.AI_MODEL || "claude-opus-5-5";

let _client: Anthropic | null = null;
export function claude() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY");
  if (!_client) _client = new Anthropic({ timeout: 10 * 60 * 1000 });
  return _client;
}

export const EXPERT_SYSTEM = `คุณคือ "AI Ads Expert" ผู้เชี่ยวชาญ Facebook/Instagram Ads (Meta Ads) ระดับ senior media buyer ที่ดูแลบัญชีโฆษณามาหลายร้อยบัญชีในประเทศไทยและต่างประเทศ
หลักการทำงานของคุณ:
- ตัดสินใจจากข้อมูลตัวเลขจริงที่ได้รับเท่านั้น ห้ามเดาตัวเลขที่ไม่มี
- รู้จัก learning phase: ad set ที่ใช้จ่ายน้อยหรือผลลัพธ์น้อยกว่า ~10-20 ครั้งต่อสัปดาห์ ยังตัดสินไม่ได้ ให้รอ
- ปรับงบทีละน้อย (ไม่เกิน % ที่กำหนด) เพื่อไม่ให้ learning phase รีเซ็ต
- ให้เหตุผลสั้น ชัด อ้างอิงตัวเลข (CPA, ROAS, CTR, Frequency, เทรนด์)
- ตอบเป็นภาษาไทยที่เป็นธรรมชาติ อ่านง่าย ใช้ศัพท์โฆษณาที่นักการตลาดไทยใช้กัน (เช่น CPA, ROAS, CTR, กลุ่มเป้าหมาย, ครีเอทีฟ)
- ระวังความเสี่ยง: ถ้าไม่แน่ใจ ให้เลือก "keep" และบอกว่าควรดูอะไรเพิ่ม`;

/** เรียก Claude แล้วรับผลลัพธ์เป็น JSON ตาม zod schema */
export async function askJSON<T extends z.ZodType>(opts: {
  schema: T;
  user: string;
  system?: string;
  effort?: "low" | "medium" | "high" | "xhigh";
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const stream = claude().messages.stream({
    model: AI_MODEL,
    max_tokens: opts.maxTokens ?? 32000,
    system: [{ type: "text", text: opts.system ?? EXPERT_SYSTEM, cache_control: { type: "ephemeral" } }],
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort ?? "high", format: zodOutputFormat(opts.schema) },
    messages: [{ role: "user", content: opts.user }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") {
    throw new Error(`AI ปฏิเสธคำขอ (${msg.stop_details?.category ?? "unknown"}): ${msg.stop_details?.explanation ?? ""}`);
  }
  if (msg.stop_reason === "max_tokens") throw new Error("AI ตอบยาวเกินขีดจำกัด ลองลดข้อมูลที่ส่ง");
  const text = msg.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("AI ไม่ได้ส่งผลลัพธ์กลับมา");
  const parsed = opts.schema.safeParse(JSON.parse(text.text));
  if (!parsed.success) throw new Error(`ผลลัพธ์จาก AI ไม่ตรง schema: ${parsed.error.message}`);
  return parsed.data;
}

/** เรียก Claude แล้วรับผลลัพธ์เป็นข้อความ (markdown) */
export async function askText(opts: { user: string; system?: string; effort?: "low" | "medium" | "high" | "xhigh"; maxTokens?: number }) {
  const stream = claude().messages.stream({
    model: AI_MODEL,
    max_tokens: opts.maxTokens ?? 32000,
    system: [{ type: "text", text: opts.system ?? EXPERT_SYSTEM, cache_control: { type: "ephemeral" } }],
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort ?? "high" },
    messages: [{ role: "user", content: opts.user }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error(`AI ปฏิเสธคำขอ: ${msg.stop_details?.explanation ?? ""}`);
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
