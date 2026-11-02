import { handler, ok } from "@/lib/api";
import { requireAccount } from "@/lib/accounts";
import { AudienceBriefSchema, generateAudiencePlan, resolveSegments } from "@/lib/ai/audience";
import { prisma } from "@/lib/db";

export const POST = handler(async (req) => {
  const body = await req.json();
  const brief = AudienceBriefSchema.parse(body);
  const { account, client } = await requireAccount(body.accountId);
  const plan = await generateAudiencePlan(brief);
  const segments = await resolveSegments(client, account.id, plan, brief.countries);
  if (body.save !== false) {
    for (const s of segments) {
      await prisma.audienceSuggestion.create({
        data: {
          accountId: account.id,
          name: s.name,
          rationale: `${s.persona}\n\n${s.rationale}\n\nมุมสื่อสาร: ${s.angle}`,
          targetingJson: JSON.stringify(s.targeting),
          estimateJson: s.estimate ? JSON.stringify(s.estimate) : null,
          brief: brief.product,
        },
      });
    }
  }
  return ok({ plan, segments });
});
