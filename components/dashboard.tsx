"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, ChevronDown, ChevronUp, Minus, Pause, Pencil, Play, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { cn, fmtMoney, fmtNum, fmtPct } from "@/lib/utils";
import { api } from "@/lib/client";
import type { EntityWithMetrics, Metrics } from "@/lib/meta/types";
import type { Brief } from "@/lib/summary";
import { pctChange } from "@/lib/meta/insights";

// ---------- Health ring ----------
export function HealthRing({ score, grade }: { score: number; grade: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? "hsl(160 84% 55%)" : score >= 65 ? "hsl(180 90% 55%)" : score >= 45 ? "hsl(38 95% 58%)" : "hsl(340 85% 62%)";
  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} stroke="hsl(228 20% 20%)" strokeWidth="10" fill="none" />
        <circle cx="60" cy="60" r={r} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * score) / 100} style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-bold" style={{ color }}>{score}</div>
        <div className="text-[11px] text-muted-foreground">{grade}</div>
      </div>
    </div>
  );
}

// ---------- Sparkline ----------
export function Sparkline({ data, color = "hsl(250 90% 66%)" }: { data: number[]; color?: string }) {
  const rows = data.map((v, i) => ({ i, v }));
  const id = useMemo(() => `sp${Math.random().toString(36).slice(2, 8)}`, []);
  if (!rows.length) return null;
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={rows} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.5} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---------- KPI tile ----------
export function KpiTile({ label, value, change, invert, series, color, hint }: { label: string; value: string; change?: number; invert?: boolean; series?: number[]; color?: string; hint?: string }) {
  const good = change === undefined ? null : invert ? change < 0 : change > 0;
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        </div>
        {change !== undefined && Number.isFinite(change) && (
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", good ? "bg-emerald-500/15 text-emerald-300" : change === 0 ? "bg-white/5 text-muted-foreground" : "bg-rose-500/15 text-rose-300")}>
            {change >= 0 ? "+" : ""}{change.toFixed(0)}%
          </span>
        )}
      </div>
      {series && series.length > 1 && <div className="mt-2 -mx-1"><Sparkline data={series} color={color} /></div>}
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function resultLabel(t: string) {
  return ({ purchase: "การซื้อ", lead: "ลีด", messaging: "ข้อความ", link_click: "คลิกลิงก์", post_engagement: "การมีส่วนร่วม", reach: "การเข้าถึง", app_install: "ติดตั้งแอป", mixed: "ผลลัพธ์รวม" } as Record<string, string>)[t] || t;
}

export function KpiRow({ m, prev, daily, currency }: { m: Metrics; prev?: Metrics; daily?: Array<{ date: string } & Metrics>; currency: string }) {
  const ch = (k: keyof Metrics) => (prev ? pctChange(m[k] as number, prev[k] as number) : undefined);
  const s = (k: keyof Metrics) => daily?.map((d) => d[k] as number) ?? [];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <KpiTile label="ใช้จ่าย" value={fmtMoney(m.spend, currency)} change={ch("spend")} series={s("spend")} />
      <KpiTile label={resultLabel(m.resultType)} value={fmtNum(m.results)} change={ch("results")} series={s("results")} color="hsl(170 80% 50%)" />
      <KpiTile label="ต้นทุน/ผลลัพธ์" value={m.cpa ? fmtMoney(m.cpa, currency) : "-"} change={m.cpa ? ch("cpa") : undefined} invert series={s("cpa")} color="hsl(38 95% 58%)" />
      <KpiTile label="ROAS" value={m.roas ? `${m.roas.toFixed(2)}x` : "-"} change={m.roas ? ch("roas") : undefined} series={s("roas")} color="hsl(320 90% 65%)" hint={m.revenue ? `ยอดขาย ${fmtMoney(m.revenue, currency)}` : undefined} />
      <KpiTile label="CTR" value={fmtPct(m.ctr)} change={ch("ctr")} series={s("ctr")} color="hsl(200 95% 60%)" />
      <KpiTile label="ความถี่" value={m.frequency.toFixed(2)} change={ch("frequency")} invert series={s("frequency")} color="hsl(280 80% 65%)" hint={`เข้าถึง ${fmtNum(m.reach)} คน`} />
    </div>
  );
}

// ---------- AI Brief ----------
const toneStyle: Record<string, string> = { good: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100", warn: "border-amber-400/30 bg-amber-500/10 text-amber-100", bad: "border-rose-400/30 bg-rose-500/10 text-rose-100", info: "border-white/10 bg-white/5 text-foreground" };
const toneIcon: Record<string, string> = { good: "✅", warn: "⚠️", bad: "🚨", info: "💡" };

export function AiBrief({ brief, currency, onAction, onDeep, deep, deepLoading }: {
  brief: Brief; currency: string;
  onAction: (a: Brief["actions"][number]) => void;
  onDeep: () => void;
  deep: { headline: string; explanation: string; wins: string[]; problems: string[]; next_steps: Array<{ text: string; priority: string; expected_impact: string }> } | null;
  deepLoading: boolean;
}) {
  return (
    <div className="glass-strong rounded-3xl p-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <HealthRing score={brief.score} grade={brief.grade} />
          <div className="text-[11px] text-muted-foreground">คะแนนสุขภาพโฆษณา</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-xs text-violet-300"><Sparkles className="h-3.5 w-3.5" /> AI สรุปให้เข้าใจง่าย</div>
          <h2 className="text-xl font-semibold leading-snug md:text-2xl">{deep?.headline || brief.headline}</h2>
          {deep && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{deep.explanation}</p>}
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {(deep ? [...deep.wins.map((t) => ({ tone: "good", text: t })), ...deep.problems.map((t) => ({ tone: "bad", text: t }))] : brief.bullets).map((b, i) => (
              <div key={i} className={cn("flex gap-2 rounded-xl border px-3 py-2 text-sm", toneStyle[b.tone])}><span>{toneIcon[b.tone]}</span><span>{b.text}</span></div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="cyan">{brief.stats.activeCampaigns} แคมเปญเปิดอยู่</Badge>
            <Badge variant="purple">{brief.stats.activeAdsets} ad set</Badge>
            {brief.stats.learningAdsets > 0 && <Badge variant="warning">{brief.stats.learningAdsets} กำลังเรียนรู้</Badge>}
            <Badge variant="muted">งบรวม {fmtMoney(brief.stats.dailyBudgetTotal, currency)}/วัน ≈ {fmtMoney(brief.stats.projectedMonthly, currency)}/เดือน</Badge>
          </div>
        </div>
        <div className="w-full shrink-0 space-y-2 lg:w-72">
          <div className="text-xs font-medium text-muted-foreground">AI แนะนำให้ทำตอนนี้</div>
          {(deep ? deep.next_steps.map((n) => ({ text: `${n.text} (${n.priority}) – ${n.expected_impact}`, kind: "info" as const })) : brief.actions).map((a, i) => (
            <button key={i} onClick={() => onAction(a)} className={cn("w-full rounded-xl border px-3 py-2 text-left text-sm transition hover:bg-white/10", a.kind === "scale_up" ? "border-emerald-400/30" : a.kind === "pause" || a.kind === "scale_down" ? "border-amber-400/30" : "border-white/10")}>
              {a.kind === "scale_up" ? "📈 " : a.kind === "scale_down" ? "📉 " : a.kind === "pause" ? "⏸ " : a.kind === "creative" ? "✍️ " : "→ "}{a.text}
            </button>
          ))}
          {!brief.actions.length && !deep && <div className="rounded-xl border border-white/10 px-3 py-2 text-sm text-muted-foreground">ยังไม่มีสิ่งที่ต้องรีบทำ</div>}
          <Button className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90" onClick={onDeep} disabled={deepLoading}>
            <Sparkles /> {deepLoading ? "AI กำลังวิเคราะห์..." : deep ? "วิเคราะห์ใหม่" : "ให้ AI วิเคราะห์เชิงลึก"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Charts ----------
export function TrendChart({ data, currency }: { data: Array<{ date: string } & Metrics>; currency: string }) {
  const rows = data.map((d) => ({ date: d.date.slice(5), spend: Math.round(d.spend), results: d.results, cpa: Math.round(d.cpa) }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={rows} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(250 90% 66%)" stopOpacity={0.6} /><stop offset="100%" stopColor="hsl(250 90% 66%)" stopOpacity={0} /></linearGradient>
          <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(170 80% 50%)" stopOpacity={0.6} /><stop offset="100%" stopColor="hsl(170 80% 50%)" stopOpacity={0} /></linearGradient>
        </defs>
        <XAxis dataKey="date" fontSize={11} stroke="hsl(220 14% 50%)" tickLine={false} axisLine={false} />
        <YAxis yAxisId="l" fontSize={11} stroke="hsl(220 14% 50%)" tickLine={false} axisLine={false} />
        <YAxis yAxisId="r" orientation="right" fontSize={11} stroke="hsl(220 14% 50%)" tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: "hsl(228 30% 10%)", border: "1px solid hsl(228 30% 25%)", borderRadius: 12 }} formatter={(v: number, n: string) => [n === "ใช้จ่าย" ? `${v.toLocaleString()} ${currency}` : v, n]} />
        <Area yAxisId="l" type="monotone" dataKey="spend" name="ใช้จ่าย" stroke="hsl(250 90% 70%)" strokeWidth={2} fill="url(#gSpend)" />
        <Area yAxisId="r" type="monotone" dataKey="results" name="ผลลัพธ์" stroke="hsl(170 80% 55%)" strokeWidth={2} fill="url(#gRes)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const PALETTE = ["hsl(250 90% 66%)", "hsl(170 80% 50%)", "hsl(38 95% 58%)", "hsl(320 90% 65%)", "hsl(200 95% 60%)", "hsl(280 80% 65%)"];

export function Donut({ data, label }: { data: Array<{ name: string; value: number }>; label: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">ไม่มีข้อมูล</div>;
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "hsl(228 30% 10%)", border: "1px solid hsl(228 30% 25%)", borderRadius: 12 }} formatter={(v: number) => `${Math.round((v / total) * 100)}%`} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"><div className="text-[10px] text-muted-foreground">{label}</div></div>
      </div>
      <div className="space-y-1 text-xs">
        {data.slice(0, 6).map((d, i) => (
          <div key={d.name} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="truncate">{d.name}</span><span className="ml-auto text-muted-foreground">{Math.round((d.value / total) * 100)}%</span></div>
        ))}
      </div>
    </div>
  );
}

export function AgeGenderChart({ data }: { data: Array<{ age: string; gender: string; spend: number; results: number }> }) {
  const ages = [...new Set(data.filter((d) => d.age).map((d) => d.age))].sort();
  const rows = ages.map((age) => ({ age, ชาย: Math.round(data.filter((d) => d.age === age && d.gender === "male").reduce((s, d) => s + d.spend, 0)), หญิง: Math.round(data.filter((d) => d.age === age && d.gender === "female").reduce((s, d) => s + d.spend, 0)) }));
  if (!rows.length) return <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">ไม่มีข้อมูล</div>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={rows} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
        <XAxis dataKey="age" fontSize={11} stroke="hsl(220 14% 50%)" tickLine={false} axisLine={false} />
        <YAxis fontSize={11} stroke="hsl(220 14% 50%)" tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: "hsl(228 30% 10%)", border: "1px solid hsl(228 30% 25%)", borderRadius: 12 }} />
        <Bar dataKey="ชาย" stackId="a" fill="hsl(200 95% 60%)" radius={[0, 0, 4, 4]} />
        <Bar dataKey="หญิง" stackId="a" fill="hsl(320 90% 65%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------- Entity manager (edit / delete / budget) ----------
export function EntityRow({ e, currency, onChanged, targetCpa }: { e: EntityWithMetrics; currency: string; onChanged: () => void; targetCpa?: number | null }) {
  const [budget, setBudget] = useState<number>(e.dailyBudget ?? 0);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(e.name);
  const [busy, setBusy] = useState(false);
  const active = (e.effectiveStatus || e.status || "").toUpperCase() === "ACTIVE";
  const m = e.metrics;
  const dirty = e.dailyBudget !== undefined && Math.round(budget) !== Math.round(e.dailyBudget);
  const cpaTone = !m.results ? "text-muted-foreground" : targetCpa ? (m.cpa <= targetCpa ? "text-emerald-300" : m.cpa <= targetCpa * 1.3 ? "text-amber-300" : "text-rose-300") : "";

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try { await fn(); toast.success(okMsg); onChanged(); } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };
  const post = (json: Record<string, unknown>) => api(`/api/entities/${e.id}`, { method: "POST", json: { ...json, name: e.name, entityType: e.level } });

  return (
    <div className={cn("glass rounded-2xl p-4 transition", !active && "opacity-70")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-1">
              <Input value={name} onChange={(ev) => setName(ev.target.value)} className="h-8 max-w-sm" />
              <Button size="sm" variant="success" disabled={busy || !name.trim()} onClick={() => run(() => post({ newName: name.trim() }), "เปลี่ยนชื่อแล้ว").then(() => setEditingName(false))}><Check /></Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditingName(false); setName(e.name); }}><X /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{e.name}</span>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditingName(true)} title="เปลี่ยนชื่อ"><Pencil className="h-3.5 w-3.5" /></button>
              <StatusBadge status={e.effectiveStatus} />
            </div>
          )}
          <div className="mt-0.5 text-xs text-muted-foreground">{e.level === "adset" ? e.campaignName : e.objective}{e.optimizationGoal ? ` · ${e.optimizationGoal}` : ""}</div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant={active ? "outline" : "success"} disabled={busy} onClick={() => run(() => post({ status: active ? "PAUSED" : "ACTIVE" }), active ? "หยุดแล้ว" : "เปิดแล้ว")}>
            {active ? <><Pause /> หยุด</> : <><Play /> เปิด</>}
          </Button>
          <Button size="sm" variant="ghost" className="text-rose-300 hover:bg-rose-500/10" disabled={busy} title="ลบ"
            onClick={() => { if (confirm(`ลบ "${e.name}" ออกจาก Meta? การลบย้อนกลับไม่ได้`)) run(() => api(`/api/entities/${e.id}?entityType=${e.level}&name=${encodeURIComponent(e.name)}`, { method: "DELETE" }), "ลบแล้ว"); }}>
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-sm md:grid-cols-6">
        <Stat label="ใช้จ่าย" value={fmtMoney(m.spend, currency)} />
        <Stat label={resultLabel(m.resultType)} value={fmtNum(m.results)} />
        <Stat label="ต้นทุน/ผล" value={m.cpa ? fmtMoney(m.cpa, currency) : "-"} className={cpaTone} />
        <Stat label="ROAS" value={m.roas ? `${m.roas.toFixed(2)}x` : "-"} />
        <Stat label="CTR" value={fmtPct(m.ctr)} />
        <Stat label="ความถี่" value={m.frequency.toFixed(2)} className={m.frequency >= 3.5 ? "text-amber-300" : ""} />
      </div>

      {e.dailyBudget !== undefined ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-white/5 p-2">
          <span className="text-xs text-muted-foreground">งบ/วัน</span>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setBudget(Math.max(1, Math.round(budget * 0.9)))}><Minus /></Button>
          <Input type="number" value={budget} onChange={(ev) => setBudget(Number(ev.target.value))} className="h-8 w-28 text-center tabular-nums" />
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setBudget(Math.round(budget * 1.1))}><Plus /></Button>
          <span className="text-xs text-muted-foreground">−10% / +10%</span>
          {dirty && (
            <>
              <Button size="sm" variant="success" disabled={busy || budget <= 0} onClick={() => run(() => post({ dailyBudget: budget }), `ปรับงบเป็น ${fmtMoney(budget, currency)}/วัน แล้ว`)}><Check /> บันทึก {fmtMoney(e.dailyBudget, currency)} → {fmtMoney(budget, currency)}</Button>
              <Button size="sm" variant="ghost" onClick={() => setBudget(e.dailyBudget ?? 0)}>ยกเลิก</Button>
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 text-xs text-muted-foreground">{e.level === "campaign" ? "งบตั้งที่ระดับ ad set" : "ใช้งบระดับแคมเปญ (CBO)"}</div>
      )}
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("font-medium tabular-nums", className)}>{value}</div>
    </div>
  );
}

// ---------- Quick create campaign ----------
export function QuickCreate({ open, onClose, onCreated, currency }: { open: boolean; onClose: () => void; onCreated: () => void; currency: string }) {
  const [form, setForm] = useState({ name: "", objective: "OUTCOME_SALES", dailyBudget: "", status: "PAUSED" });
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const submit = async () => {
    setBusy(true);
    try {
      await api("/api/campaigns", { method: "POST", json: { ...form, dailyBudget: form.dailyBudget ? Number(form.dailyBudget) : undefined } });
      toast.success("สร้างแคมเปญแล้ว");
      onCreated();
      onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-strong w-full max-w-md rounded-3xl p-6" onClick={(ev) => ev.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">สร้างแคมเปญใหม่</h3><button onClick={onClose}><X className="h-5 w-5" /></button></div>
        <div className="space-y-3">
          <div><label className="mb-1 block text-xs text-muted-foreground">ชื่อแคมเปญ</label><Input value={form.name} onChange={(ev) => setForm({ ...form, name: ev.target.value })} placeholder="เช่น ขายเซรั่ม - พ.ย." /></div>
          <div><label className="mb-1 block text-xs text-muted-foreground">เป้าหมาย</label>
            <Select value={form.objective} onChange={(ev) => setForm({ ...form, objective: ev.target.value })}>
              <option value="OUTCOME_SALES">ยอดขาย</option><option value="OUTCOME_LEADS">ลีด</option><option value="OUTCOME_ENGAGEMENT">การมีส่วนร่วม / ทักแชท</option><option value="OUTCOME_TRAFFIC">คนเข้าเว็บ</option><option value="OUTCOME_AWARENESS">การรับรู้</option>
            </Select></div>
          <div><label className="mb-1 block text-xs text-muted-foreground">งบ/วัน ระดับแคมเปญ ({currency}) – เว้นว่างถ้าจะตั้งที่ ad set</label><Input type="number" value={form.dailyBudget} onChange={(ev) => setForm({ ...form, dailyBudget: ev.target.value })} /></div>
          <div><label className="mb-1 block text-xs text-muted-foreground">สถานะเริ่มต้น</label>
            <Select value={form.status} onChange={(ev) => setForm({ ...form, status: ev.target.value })}><option value="PAUSED">หยุด (แนะนำ – ไปใส่ ad set/โฆษณาก่อน)</option><option value="ACTIVE">เปิดทันที</option></Select></div>
          <p className="text-xs text-muted-foreground">แคมเปญเปล่าจะยังไม่แสดงโฆษณาจนกว่าจะมี ad set + โฆษณา ให้ AI วางแผนทั้งชุดได้ที่เมนู "AI วางแผนแคมเปญ"</p>
          <Button className="w-full" disabled={busy || !form.name.trim()} onClick={submit}>{busy ? "กำลังสร้าง..." : "สร้างใน Meta"}</Button>
        </div>
      </div>
    </div>
  );
}

export function Collapsible({ title, count, children, defaultOpen = true }: { title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="mb-2 flex w-full items-center justify-between text-left">
        <span className="font-semibold">{title} {count !== undefined && <span className="text-xs text-muted-foreground">({count})</span>}</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && children}
    </div>
  );
}
