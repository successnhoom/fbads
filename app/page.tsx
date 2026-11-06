"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Empty, ErrorBox, Loading } from "@/components/ui/misc";
import { PendingActions } from "@/components/pending-actions";
import { AgeGenderChart, AiBrief, Collapsible, Donut, EntityRow, KpiRow, QuickCreate, TrendChart } from "@/components/dashboard";
import { api, useFetch } from "@/lib/client";
import type { AccountSnapshot } from "@/lib/meta/data";
import { buildBrief, type Brief } from "@/lib/summary";
import type { AutomationSettings } from "@prisma/client";

type Deep = { headline: string; explanation: string; wins: string[]; problems: string[]; next_steps: Array<{ text: string; priority: string; expected_impact: string }> };

export default function Dashboard() {
  const [days, setDays] = useState(7);
  const [tab, setTab] = useState<"adset" | "campaign">("adset");
  const [showCreate, setShowCreate] = useState(false);
  const [deep, setDeep] = useState<Deep | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const { data, error, loading, reload } = useFetch<{ account: { id: string; name: string; currency: string }; snapshot: AccountSnapshot }>(`/api/overview?days=${days}&breakdowns=1`);
  const { data: settings } = useFetch<AutomationSettings>("/api/automation/settings");

  const brief: Brief | null = useMemo(
    () => (data ? buildBrief(data.snapshot, { cpa: settings?.targetCpa, roas: settings?.targetRoas, minSpend: settings?.minSpendToJudge }) : null),
    [data, settings],
  );

  const runDeep = async () => {
    setDeepLoading(true);
    try {
      const r = await api<{ ai: Deep }>("/api/ai/summary", { method: "POST", json: { days } });
      setDeep(r.ai);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeepLoading(false);
    }
  };

  const onAction = async (a: Brief["actions"][number]) => {
    if (a.kind === "creative") return void (window.location.href = "/creatives");
    if (!a.entityId || !data) return void (window.location.href = "/planner");
    const ent = data.snapshot.adsets.find((x) => x.id === a.entityId);
    if (!ent) return;
    try {
      if (a.kind === "pause") {
        if (!confirm(`หยุด "${ent.name}" ?`)) return;
        await api(`/api/entities/${ent.id}`, { method: "POST", json: { status: "PAUSED", name: ent.name, entityType: "adset" } });
      } else if ((a.kind === "scale_up" || a.kind === "scale_down") && ent.dailyBudget) {
        const nb = Math.round(ent.dailyBudget * (a.kind === "scale_up" ? 1.2 : 0.8));
        if (!confirm(`ปรับงบ "${ent.name}" จาก ${ent.dailyBudget} เป็น ${nb} ${data.account.currency}/วัน ?`)) return;
        await api(`/api/entities/${ent.id}`, { method: "POST", json: { dailyBudget: nb, name: ent.name, entityType: "adset" } });
      }
      toast.success("ทำรายการแล้ว");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (error) {
    return (
      <div>
        <Header />
        <ErrorBox error={error} />
        {error.includes("ยังไม่ได้เชื่อมต่อ") && <Button asChild className="mt-4"><Link href="/settings">ไปเชื่อมต่อบัญชีโฆษณา</Link></Button>}
      </div>
    );
  }
  if (loading || !data || !brief) return <div><Header /><Loading text="AI กำลังดึงข้อมูลจาก Meta..." /></div>;
  const { snapshot: s, account } = data;
  const cur = account.currency;
  const placement = Object.values(
    s.breakdowns.placement.reduce((acc, b) => { const k = `${b.platform} ${b.position}`.replace(/_/g, " "); acc[k] = acc[k] || { name: k, value: 0 }; acc[k].value += b.spend; return acc; }, {} as Record<string, { name: string; value: number }>),
  ).sort((a, b) => b.value - a.value);
  const campaignSpend = s.campaigns.filter((c) => c.metrics.spend > 0).map((c) => ({ name: c.name, value: c.metrics.spend })).sort((a, b) => b.value - a.value);
  const list = (tab === "adset" ? s.adsets : s.campaigns).slice().sort((a, b) => b.metrics.spend - a.metrics.spend);

  return (
    <div className="space-y-6">
      <Header accountName={account.name} since={s.since} until={s.until}>
        <Select value={days} onChange={(e) => { setDays(Number(e.target.value)); setDeep(null); }} className="w-32">
          <option value={1}>วันนี้</option><option value={3}>3 วัน</option><option value={7}>7 วัน</option><option value={14}>14 วัน</option><option value={30}>30 วัน</option>
        </Select>
        <Button variant="outline" size="sm" onClick={reload}><RefreshCw /> รีเฟรช</Button>
        <Button size="sm" className="bg-gradient-to-r from-violet-600 to-cyan-500 hover:opacity-90" onClick={() => setShowCreate(true)}><Plus /> สร้างแคมเปญ</Button>
      </Header>

      <AiBrief brief={brief} currency={cur} onAction={onAction} onDeep={runDeep} deep={deep} deepLoading={deepLoading} />

      <KpiRow m={s.account.metrics} prev={s.account.prevMetrics} daily={s.account.daily} currency={cur} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">ค่าใช้จ่ายและผลลัพธ์รายวัน</h3><Badge variant="muted">{s.since} → {s.until}</Badge></div>
          {s.account.daily?.length ? <TrendChart data={s.account.daily} currency={cur} /> : <Empty text="ยังไม่มีข้อมูลในช่วงนี้" />}
        </div>
        <PendingActions />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass rounded-2xl p-5"><h3 className="mb-2 font-semibold">งบไปที่ไหน (ตามแคมเปญ)</h3><Donut data={campaignSpend} label="แคมเปญ" /></div>
        <div className="glass rounded-2xl p-5"><h3 className="mb-2 font-semibold">Placement ที่ใช้งบ</h3><Donut data={placement} label="placement" /></div>
        <div className="glass rounded-2xl p-5"><h3 className="mb-2 font-semibold">ใช้จ่ายตามอายุ / เพศ</h3><AgeGenderChart data={s.breakdowns.ageGender} /></div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">จัดการโฆษณา <span className="text-sm font-normal text-muted-foreground">แก้ชื่อ · ปรับงบ · หยุด/เปิด · ลบ ได้ทันที</span></h3>
          <div className="flex gap-1 rounded-xl bg-white/5 p-1 text-sm">
            {(["adset", "campaign"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1 ${tab === t ? "bg-primary text-white shadow" : "text-muted-foreground"}`}>{t === "adset" ? `Ad set (${s.adsets.length})` : `แคมเปญ (${s.campaigns.length})`}</button>
            ))}
          </div>
        </div>
        {!list.length ? (
          <Empty text="ยังไม่มีรายการ – สร้างแคมเปญหรือให้ AI วางแผนได้เลย" />
        ) : (
          <Collapsible title={tab === "adset" ? "Ad set ทั้งหมด" : "แคมเปญทั้งหมด"} count={list.length}>
            <div className="grid gap-3 xl:grid-cols-2">
              {list.map((e) => <EntityRow key={e.id} e={e} currency={cur} onChanged={reload} targetCpa={settings?.targetCpa} />)}
            </div>
          </Collapsible>
        )}
      </div>

      <QuickCreate open={showCreate} onClose={() => setShowCreate(false)} onCreated={reload} currency={cur} />
    </div>
  );
}

function Header({ accountName, since, until, children }: { accountName?: string; since?: string; until?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="pulse-dot inline-block h-2 w-2 rounded-full bg-emerald-400 text-emerald-400" /> AI Live · เชื่อมต่อ Meta Marketing API</div>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl"><span className="text-gradient">แดชบอร์ด AI</span>{accountName ? ` – ${accountName}` : ""}</h1>
        {since && <p className="mt-1 text-sm text-muted-foreground">ข้อมูล {since} ถึง {until} <Sparkles className="ml-1 inline h-3 w-3 text-violet-300" /> อัปเดตสดจากบัญชีโฆษณา</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
