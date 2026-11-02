import { handler, ok } from "@/lib/api";
import { generateCreatives } from "@/lib/ai/creative";

export const POST = handler(async (req) => {
  const body = await req.json();
  if (!body.product) throw new Error("กรุณาระบุสินค้า/บริการ");
  return ok(await generateCreatives(body));
});
