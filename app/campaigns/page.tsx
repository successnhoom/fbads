"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Pause, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { Empty, ErrorBox, Loading, PageHeader } from "@/components/ui/misc";
import { resultLabel } from "@/components/metrics";
import { api, useFetch } from "@/lib/client";
import type { AccountSnapshot } from "@/lib/meta/data";
import type { EntityWithMetrics } from "@/lib/meta/types";
import { fmtMoney, fmtNum, fmtPct } from "@/lib/utils";

export default function CampaignsPage() {
  const [days, setDays] = useState(7);
  const [tab, setTab] = useState<"campaign" | "adset" | "ad">("adset");
  const { data, error, loading, reload } = useFetch<{ account: { currency: string }; snapshot: AccountSnapshot }>(`/api/overview?days=${days}&ads=1`);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (e: EntityWithMetrics, body: { status?: "ACTIVE" | "PAUSED"; dailyBudget?: number }) => {
    setBusy(e.id);
    try {
      await api(`/api/entities/${e.id}`, { method: "POST", json: { ...body, name: e.name, entityType: e.level } });
      toast.success("บันทึกแล้ว");
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (error) return <div><PageHeader title="แคมเปญ" /><ErrorBox error={error} /></div>;
  if (loading || !data) return <Loading text="กำลังดึงโครงสร้างแคมเปญ..." />;
  const cur = data.account.currency;
  const s = data.snapshot;
  const rows = tab === "campaign" ? s.campaigns : tab === "adset" ? s.adsets : s.ads;

  return (
    <div>
      <PageHeader title="แคมเปญ / Ad set / โฆษณา" description="ดูผลและปรับสถานะ-งบด้วยมือได้ทันที (บันทึกลง log ทุกครั้ง)">
        <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-32">
          <option value={1}>วันนี้</option><option value={3}>3 วัน</option><option value={7}>7 วัน</option><option value={14}>14 วัน</option><option value={30}>30 วัน</option>
        </Select>
        <Button variant="outline" size="sm" onClick={reload}><RefreshCw /> รีเฟรช</Button>
      </PageHeader>

      <div className="mb-4 flex gap-1 rounded-md bg-muted p-1 text-sm w-fit">
        {(["campaign", "adset", "ad"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1 ${tab === t ? "bg-primary text-white shadow" : "text-muted-foreground"}`}>
            {t === "campaign" ? `แคมเปญ (${s.campaigns.length})` : t === "adset" ? `Ad set (${s.adsets.length})` : `โฆษณา (${s.ads.length})`}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>{tab === "campaign" ? "แคมเปญ" : tab === "adset" ? "Ad set" : "โฆษณา"}</CardTitle></CardHeader>
        <CardContent>
          {!rows.length ? (
            <Empty text="ไม่มีข้อมูล" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>ชื่อ</Th><Th>สถานะ</Th>{tab !== "ad" && <Th>งบ/วัน</Th>}<Th className="text-right">ใช้จ่าย</Th><Th className="text-right">ผลลัพธ์</Th><Th className="text-right">CPA</Th><Th className="text-right">ROAS</Th><Th className="text-right">CTR</Th><Th className="text-right">CPC</Th><Th className="text-right">Freq.</Th><Th>จัดการ</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <Row key={e.id} e={e} cur={cur} busy={busy === e.id} onAct={(b) => act(e, b)} showBudget={tab !== "ad"} />
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ e, cur, busy, onAct, showBudget }: { e: EntityWithMetrics; cur: string; busy: boolean; onAct: (b: { status?: "ACTIVE" | "PAUSED"; dailyBudget?: number }) => void; showBudget: boolean }) {
  const [budget, setBudget] = useState<string>(e.dailyBudget ? String(e.dailyBudget) : "");
  const active = (e.effectiveStatus || e.status || "").toUpperCase() === "ACTIVE";
  const m = e.metrics;
  return (
    <tr className="hover:bg-muted/40">
      <Td className="font-medium">{e.name}<div className="text-xs text-muted-foreground">{e.campaignName || e.objective}</div></Td>
      <Td><StatusBadge status={e.effectiveStatus} /></Td>
      {showBudget && (
        <Td>
          {e.dailyBudget !== undefined ? (
            <div className="flex items-center gap-1">
              <Input value={budget} onChange={(ev) => setBudget(ev.target.value)} className="h-7 w-24" type="number" />
              <Button size="sm" variant="ghost" disabled={busy || Number(budget) === e.dailyBudget || !Number(budget)} onClick={() => onAct({ dailyBudget: Number(budget) })}>บันทึก</Button>
            </div>
          ) : <span className="text-xs text-muted-foreground">-</span>}
        </Td>
      )}
      <Td className="text-right">{fmtMoney(m.spend, cur)}</Td>
      <Td className="text-right">{fmtNum(m.results)} <span className="text-xs text-muted-foreground">{resultLabel(m.resultType)}</span></Td>
      <Td className="text-right">{m.cpa ? fmtMoney(m.cpa, cur) : "-"}</Td>
      <Td className="text-right">{m.roas ? `${m.roas.toFixed(2)}x` : "-"}</Td>
      <Td className="text-right">{fmtPct(m.ctr)}</Td>
      <Td className="text-right">{fmtMoney(m.cpc, cur)}</Td>
      <Td className="text-right">{m.frequency.toFixed(2)}</Td>
      <Td>
        <Button size="sm" variant={active ? "outline" : "success"} disabled={busy} onClick={() => onAct({ status: active ? "PAUSED" : "ACTIVE" })}>
          {active ? <><Pause /> หยุด</> : <><Play /> เปิด</>}
        </Button>
      </Td>
    </tr>
  );
}
