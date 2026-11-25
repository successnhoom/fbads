import { handler, ok } from "@/lib/api";
import { generateCreatives } from "@/lib/ai/creative";

// AI ใช้เวลาคิด 1-3 นาที – ขยายเวลาทำงานของฟังก์ชันบน serverless
export const maxDuration = 300;

export const POST = handler(async (req) => {
  const body = await req.json();
  if (!body.product) throw new Error("กรุณาระบุสินค้า/บริการ");
  return ok(await generateCreatives(body));
});
