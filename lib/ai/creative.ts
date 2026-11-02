import { z } from "zod";
import { askJSON } from "./claude";

export const CreativeVariantSchema = z.object({
  angle: z.string().describe("มุมการสื่อสารของตัวนี้ เช่น pain point / social proof / โปรโมชัน"),
  primary_text: z.string().describe("ข้อความหลัก (Primary text) 2-6 บรรทัด มี hook บรรทัดแรก"),
  headline: z.string().max(60).describe("พาดหัวสั้น ไม่เกิน 40 ตัวอักษร"),
  description: z.string().max(90).describe("คำอธิบายใต้พาดหัว"),
  call_to_action: z.enum(["SHOP_NOW", "LEARN_MORE", "SIGN_UP", "MESSAGE_PAGE", "CONTACT_US", "GET_OFFER", "BOOK_TRAVEL", "APPLY_NOW", "SUBSCRIBE", "ORDER_NOW"]),
  visual_direction: z.string().describe("แนะนำภาพ/วิดีโอที่ควรใช้ สั้น ๆ"),
});

const CreativeSetSchema = z.object({
  strategy: z.string().describe("สรุปกลยุทธ์ข้อความ 1-3 ประโยค"),
  variants: z.array(CreativeVariantSchema).min(3).max(6),
});
export type CreativeSet = z.infer<typeof CreativeSetSchema>;

export async function generateCreatives(p: {
  product: string;
  audience?: string;
  angle?: string;
  goal?: string;
  tone?: string;
  offer?: string;
  language?: string;
  count?: number;
}): Promise<CreativeSet> {
  return askJSON({
    schema: CreativeSetSchema,
    effort: "medium",
    user: `เขียนข้อความโฆษณา Meta Ads ${p.count ?? 4} แบบ ที่แตกต่างกันด้านมุมการสื่อสาร

สินค้า/บริการ: ${p.product}
กลุ่มเป้าหมาย: ${p.audience || "ทั่วไป"}
มุมหลักที่ต้องการ: ${p.angle || "ให้เลือกเอง"}
เป้าหมาย: ${p.goal || "ยอดขาย"}
ข้อเสนอ/โปรโมชัน: ${p.offer || "-"}
โทนเสียง: ${p.tone || "เป็นกันเอง น่าเชื่อถือ"}
ภาษา: ${p.language || "ไทย"}

กติกา:
- บรรทัดแรกต้องเป็น hook ที่หยุดนิ้วได้ ภายใน 1 ประโยค
- ห้ามอ้างสรรพคุณเกินจริง/ผิดนโยบาย Meta (ห้ามพูดถึงลักษณะส่วนบุคคลตรง ๆ เช่น "คุณอ้วนไหม")
- ใช้อีโมจิพอประมาณ ไม่ล้น
- headline สั้น กระชับ`,
  });
}
