import { handler, ok } from "@/lib/api";
import { setActiveAccount } from "@/lib/accounts";

export const POST = handler(async (req) => {
  const { id } = (await req.json()) as { id: string };
  await setActiveAccount(id);
  return ok({ id });
});
