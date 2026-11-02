"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Rocket, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/misc";
import { api, useFetch } from "@/lib/client";
import type { CampaignPlan, LaunchResult } from "@/lib/ai/planner";
import type { CampaignPlan as PlanRow } from "@prisma/client";
import { safeJson } from "@/lib/utils";

export default function PlannerPage() {
  const [form, setForm] = useState({ product: "", goal: "sales", dailyBudget: "500", countries: "TH", landingUrl: "", offer: "", extra: "", imageUrl: "" });
  const [busy, setBusy] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [current, setCurrent] = useState<{ id: string; plan: CampaignPlan } | null>(null);
  const [launched, setLaunched] = useState<LaunchResult | null>(null);
  const { data: plans, reload } = useFetch<PlanRow[]>("/api/ai/plan");

  const generate = async () => {
    setBusy(true);
    setLaunched(null);
    try {
      const r = await api<{ id: string; plan: CampaignPlan }>("/api/ai/plan", {
        method: "POST",
        json: { ...form, dailyBudget: Number(form.dailyBudget), countries: form.countries.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean) },
      });
      setCurrent(r);
      reload();
      toast.success("AI วางแผนเสร็จแล้ว ตรวจสอบแล้วกดสร้างแคมเปญ");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const launch = async (status: "PAUSED" | "ACTIVE") => {
    if (!current) return;
    if (!confirm(status === "ACTIVE" ? "สร้างและเปิดแคมเปญทันที? งบจะเริ่มถูกใช้" : "สร้างแคมเปญในสถานะหยุด (ตรวจใน Ads Manager แล้วค่อยเปิด)?")) return;
    setLaunching(true);
    try {
      const r = await api<LaunchResult>(`/api/ai/plan/${current.id}/launch`, { method: "POST", json: { status, plan: current.plan } });
      setLaunched(r);
      reload();
      toast.success("สร้างแคมเปญใน Meta สำเร็จ");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLaunching(false);
    }
  };

  const plan = current?.plan;
  const totalBudget = plan?.adsets.reduce((s, a) => s + a.daily_budget, 0) ?? 0;

  return (
    <div>
      <PageHeader title="AI วางแผนแคมเปญ" description="บอกสินค้า + งบ → AI วางโครงสร้าง, กลุ่มเป้าหมาย, แบ่งงบ, เขียนแอด แล้วสร้างจริงในบัญชีได้ทันที" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>บรีฟ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="สินค้า / บริการ *"><Textarea value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="อธิบายสินค้า ราคา จุดเด่น ลูกค้าหลัก" /></Field>
            <Field label="เป้าหมาย">
              <Select value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })}>
                <option value="sales">ยอดขาย (Conversions – ต้องมี pixel)</option>
                <option value="messages">ทักแชท Messenger</option>
                <option value="leads">ลีด / ลงทะเบียน</option>
                <option value="traffic">คนเข้าเว็บ</option>
                <option value="awareness">การรับรู้ / เข้าถึง</option>
              </Select>
            </Field>
            <Field label="งบรวมต่อวัน *"><Input type="number" value={form.dailyBudget} onChange={(e) => setForm({ ...form, dailyBudget: e.target.value })} /></Field>
            <Field label="ประเทศ"><Input value={form.countries} onChange={(e) => setForm({ ...form, countries: e.target.value })} /></Field>
            <Field label="Landing page URL"><Input value={form.landingUrl} onChange={(e) => setForm({ ...form, landingUrl: e.target.value })} placeholder="https://..." /></Field>
            <Field label="รูปภาพโฆษณา (URL)" hint="ถ้าว่าง Meta จะดึงภาพจาก landing page"><Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://.../image.jpg" /></Field>
            <Field label="ข้อเสนอ"><Input value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} /></Field>
            <Field label="ข้อมูลเพิ่มเติม"><Textarea value={form.extra} onChange={(e) => setForm({ ...form, extra: e.target.value })} /></Field>
            <Button className="w-full" onClick={generate} disabled={busy || form.product.length < 3 || !Number(form.dailyBudget)}><Sparkles /> {busy ? "AI กำลังวางแผน (1-3 นาที)..." : "ให้ AI วางแผน"}</Button>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {!plan && (
            <Card>
              <CardHeader><CardTitle>แผนที่เคยสร้าง</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {!plans?.length && <p className="text-muted-foreground">ยังไม่มีแผน</p>}
                {plans?.map((p) => {
                  const pl = safeJson<CampaignPlan | null>(p.planJson, null);
                  return (
                    <button key={p.id} className="w-full rounded-md border p-3 text-left hover:border-primary" onClick={() => { if (pl) { setCurrent({ id: p.id, plan: pl }); setLaunched(safeJson<LaunchResult | null>(p.launchedIds, null)); } }}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{pl?.campaign_name || "แผน"}</span>
                        <Badge variant={p.status === "launched" ? "success" : p.status === "failed" ? "danger" : "muted"}>{p.status === "launched" ? "สร้างแล้ว" : p.status === "failed" ? "ล้มเหลว" : "ร่าง"}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleString("th-TH")}</div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {plan && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>{plan.campaign_name}</CardTitle>
                    <div className="flex gap-1"><Badge>{plan.objective}</Badge><Badge variant="purple">{plan.optimization_goal}</Badge><Badge variant="success">รวม {totalBudget}/วัน</Badge></div>
                  </div>
                  <CardDescription>{plan.strategy_summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p><b>กลยุทธ์งบ:</b> {plan.budget_strategy}</p>
                  <p><b>เป้า KPI:</b> CPA {plan.kpi_targets.cpa ?? "-"} · ROAS {plan.kpi_targets.roas ?? "-"} · CTR {plan.kpi_targets.ctr_pct ?? "-"}%</p>
                  <div><b>แผนทดสอบ:</b><ul className="list-disc pl-5">{plan.testing_plan.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
                  <div><b>ความเสี่ยง:</b><ul className="list-disc pl-5">{plan.risks.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
                  {!launched ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button onClick={() => launch("PAUSED")} disabled={launching}><Rocket /> {launching ? "กำลังสร้างใน Meta..." : "สร้างแคมเปญ (สถานะหยุด – ตรวจก่อนเปิด)"}</Button>
                      <Button variant="success" onClick={() => launch("ACTIVE")} disabled={launching}>สร้างและเปิดทันที</Button>
                      <Button variant="ghost" onClick={() => { setCurrent(null); setLaunched(null); }}>ปิด</Button>
                    </div>
                  ) : (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs">
                      ✅ สร้างแล้ว – Campaign ID {launched.campaignId}
                      <ul className="mt-1 list-disc pl-5">{launched.adsets.map((a) => <li key={a.id}>{a.name}: ad set {a.id}, โฆษณา {a.ads.length} ชิ้น{a.warnings.length ? ` – ⚠ ${a.warnings.join("; ")}` : ""}</li>)}</ul>
                      <a className="underline" target="_blank" rel="noreferrer" href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${launched.campaignId}`}>เปิดใน Ads Manager</a>
                      <Button variant="ghost" size="sm" className="ml-2" onClick={() => { setCurrent(null); setLaunched(null); }}>ปิด</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              {plan.adsets.map((a, i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="flex items-center justify-between"><CardTitle>Ad set {i + 1}: {a.name}</CardTitle><Badge variant="success">{a.daily_budget}/วัน</Badge></div>
                    <CardDescription>{a.audience_name} – {a.persona}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-xs text-muted-foreground">อายุ {a.age_min}-{a.age_max} · {a.genders.length === 1 ? (a.genders[0] === "male" ? "ชาย" : "หญิง") : "ทุกเพศ"} · {a.interest_keywords.length ? a.interest_keywords.join(", ") : "Broad / Advantage+"}</p>
                    <p>{a.rationale}</p>
                    {a.creatives.map((c, j) => (
                      <div key={j} className="rounded-md bg-muted p-3">
                        <div className="text-xs font-medium text-muted-foreground">ครีเอทีฟ {j + 1} – {c.angle} · CTA {c.call_to_action}</div>
                        <div className="mt-1 whitespace-pre-wrap">{c.primary_text}</div>
                        <div className="mt-1 text-xs"><b>{c.headline}</b> – {c.description}</div>
                        <div className="text-xs text-muted-foreground">ภาพ: {c.visual_direction}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
