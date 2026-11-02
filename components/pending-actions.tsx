"use client";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionBadge } from "@/components/ui/badge";
import { api, useFetch } from "@/lib/client";
import type { ActionLog } from "@prisma/client";
import { safeJson } from "@/lib/utils";

export function PendingActions() {
  const { data, reload } = useFetch<ActionLog[]>("/api/automation/actions?status=pending&limit=10");
  const decide = async (id: string, decision: "approve" | "reject") => {
    try {
      await api(`/api/automation/actions/${id}`, { method: "POST", json: { decision } });
      toast.success(decision === "approve" ? "ทำรายการแล้ว" : "ปฏิเสธแล้ว");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI เสนอให้ทำ (รออนุมัติ)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data?.length && <div className="text-sm text-muted-foreground">ไม่มีรายการรออนุมัติ – <Link href="/automation" className="underline">ไปหน้าออโต้ปรับงบ</Link></div>}
        {data?.map((a) => {
          const before = safeJson<{ dailyBudget?: number }>(a.beforeJson, {});
          const after = safeJson<{ dailyBudget?: number }>(a.afterJson, {});
          return (
            <div key={a.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{a.entityName}</div>
                <ActionBadge type={a.actionType} />
              </div>
              {before.dailyBudget !== undefined && after.dailyBudget !== undefined && before.dailyBudget !== after.dailyBudget && (
                <div className="text-xs text-muted-foreground">งบ {before.dailyBudget} → {after.dailyBudget}</div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{a.reason}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="success" onClick={() => decide(a.id, "approve")}>อนุมัติ</Button>
                <Button size="sm" variant="outline" onClick={() => decide(a.id, "reject")}>ปฏิเสธ</Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
