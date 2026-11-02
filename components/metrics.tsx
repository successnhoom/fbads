"use client";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, fmtMoney, fmtNum, fmtPct } from "@/lib/utils";
import type { Metrics } from "@/lib/meta/types";
import { pctChange } from "@/lib/meta/insights";

export function MetricCard({ label, value, change, invert, hint }: { label: string; value: string; change?: number; invert?: boolean; hint?: string }) {
  const good = change === undefined ? null : invert ? change < 0 : change > 0;
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {change !== undefined && Number.isFinite(change) && (
        <div className={cn("mt-1 flex items-center gap-1 text-xs", good ? "text-emerald-600" : change === 0 ? "text-muted-foreground" : "text-red-600")}>
          {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(change).toFixed(1)}% เทียบช่วงก่อน
        </div>
      )}
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </Card>
  );
}

export function resultLabel(t: string) {
  return ({ purchase: "การซื้อ", lead: "ลีด", messaging: "ข้อความ", link_click: "คลิกลิงก์", post_engagement: "การมีส่วนร่วม", reach: "การเข้าถึง", app_install: "ติดตั้งแอป", mixed: "ผลลัพธ์รวม" } as Record<string, string>)[t] || t;
}

export function KpiGrid({ m, prev, currency }: { m: Metrics; prev?: Metrics; currency: string }) {
  const ch = (k: keyof Metrics) => (prev ? pctChange(m[k] as number, prev[k] as number) : undefined);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      <MetricCard label="ใช้จ่าย" value={fmtMoney(m.spend, currency)} change={ch("spend")} />
      <MetricCard label={resultLabel(m.resultType)} value={fmtNum(m.results)} change={ch("results")} />
      <MetricCard label="ต้นทุน/ผลลัพธ์ (CPA)" value={m.cpa ? fmtMoney(m.cpa, currency) : "-"} change={m.cpa ? ch("cpa") : undefined} invert />
      <MetricCard label="ROAS" value={m.roas ? `${m.roas.toFixed(2)}x` : "-"} change={m.roas ? ch("roas") : undefined} />
      <MetricCard label="Impressions" value={fmtNum(m.impressions)} change={ch("impressions")} />
      <MetricCard label="CTR" value={fmtPct(m.ctr)} change={ch("ctr")} />
      <MetricCard label="CPC" value={fmtMoney(m.cpc, currency)} change={ch("cpc")} invert />
      <MetricCard label="CPM" value={fmtMoney(m.cpm, currency)} change={ch("cpm")} invert />
    </div>
  );
}
