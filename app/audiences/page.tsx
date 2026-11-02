"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Empty, PageHeader } from "@/components/ui/misc";
import { api, useFetch } from "@/lib/client";
import type { AudiencePlan, ResolvedSegment } from "@/lib/ai/audience";
import type { AudienceSuggestion } from "@prisma/client";
import { fmtNum, safeJson } from "@/lib/utils";

export default function AudiencesPage() {
  const [form, setForm] = useState({ product: "", goal: "ยอดขาย", countries: "TH", budgetPerDay: "", extra: "" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ plan: AudiencePlan; segments: ResolvedSegment[] } | null>(null);
  const { data: saved, reload } = useFetch<AudienceSuggestion[]>("/api/audiences");

  const run = async () => {
    setBusy(true);
    try {
      const r = await api<{ plan: AudiencePlan; segments: ResolvedSegment[] }>("/api/ai/audience", {
        method: "POST",
        json: { ...form, countries: form.countries.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean), budgetPerDay: form.budgetPerDay ? Number(form.budgetPerDay) : undefined },
      });
      setResult(r);
      reload();
      toast.success("AI หากลุ่มเป้าหมายเสร็จแล้ว");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="AI หากลุ่มเป้าหมาย" description="บอกสินค้า แล้ว AI จะคิด persona, แปลงเป็น interest จริงของ Meta พร้อมประเมินขนาด audience" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>บรีฟสินค้า</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="สินค้า / บริการ *"><Textarea value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="เช่น เซรั่มวิตามินซีลดฝ้า ราคา 590 บาท ขายผ่าน LINE และเว็บไซต์ ลูกค้าส่วนใหญ่ผู้หญิง 25-45" /></Field>
            <Field label="เป้าหมาย"><Input value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} /></Field>
            <Field label="ประเทศ (รหัส 2 ตัว คั่นด้วย ,)"><Input value={form.countries} onChange={(e) => setForm({ ...form, countries: e.target.value })} /></Field>
            <Field label="งบต่อวัน (ไม่บังคับ)"><Input type="number" value={form.budgetPerDay} onChange={(e) => setForm({ ...form, budgetPerDay: e.target.value })} /></Field>
            <Field label="ข้อมูลเพิ่มเติม"><Textarea value={form.extra} onChange={(e) => setForm({ ...form, extra: e.target.value })} placeholder="จุดเด่น คู่แข่ง กลุ่มที่เคยได้ผล/ไม่ได้ผล" /></Field>
            <Button onClick={run} disabled={busy || form.product.length < 3} className="w-full"><Sparkles /> {busy ? "AI กำลังคิด (1-2 นาที)..." : "ให้ AI หากลุ่มเป้าหมาย"}</Button>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {result && (
            <>
              <Card>
                <CardHeader><CardTitle>กลยุทธ์โดยรวม</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>{result.plan.summary}</p>
                  <p className="text-muted-foreground"><b>Broad / Advantage+:</b> {result.plan.broad_recommendation}</p>
                  {!!result.plan.exclusions.length && <p className="text-muted-foreground"><b>ควร exclude:</b> {result.plan.exclusions.join(", ")}</p>}
                </CardContent>
              </Card>
              {result.segments.map((s, i) => <SegmentCard key={i} s={s} />)}
            </>
          )}
          {!result && (
            <Card>
              <CardHeader><CardTitle>กลุ่มเป้าหมายที่บันทึกไว้</CardTitle><CardDescription>ใช้ซ้ำได้ตอนวางแผนแคมเปญ</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {!saved?.length && <Empty text="ยังไม่มี – กรอกบรีฟด้านซ้ายแล้วให้ AI หาให้" />}
                {saved?.map((a) => {
                  const t = safeJson<{ age_min?: number; age_max?: number; flexible_spec?: Array<{ interests?: Array<{ name?: string }> }> }>(a.targetingJson, {});
                  const est = safeJson<{ lower?: number; upper?: number }>(a.estimateJson, {});
                  return (
                    <div key={a.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{a.name} <span className="text-xs text-muted-foreground">({a.brief.slice(0, 40)})</span></div>
                          <div className="text-xs text-muted-foreground">อายุ {t.age_min}-{t.age_max} · {t.flexible_spec?.[0]?.interests?.map((x) => x.name).join(", ") || "broad"}{est.lower ? ` · ประมาณ ${fmtNum(est.lower)}-${fmtNum(est.upper)} คน` : ""}</div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={async () => { await api("/api/audiences", { method: "DELETE", json: { id: a.id } }); reload(); }}><Trash2 /></Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function SegmentCard({ s }: { s: ResolvedSegment }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>#{s.priority} {s.name}</CardTitle>
          <div className="flex gap-1">
            <Badge variant="purple">งบ {s.budgetSharePct}%</Badge>
            {s.estimate?.lower ? <Badge variant="default">{fmtNum(s.estimate.lower)}–{fmtNum(s.estimate.upper)} คน</Badge> : null}
          </div>
        </div>
        <CardDescription>{s.persona}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p><b>ทำไม:</b> {s.rationale}</p>
        <p><b>มุมสื่อสาร:</b> {s.angle}</p>
        <p className="text-xs text-muted-foreground">อายุ {s.targeting.age_min}-{s.targeting.age_max} · เพศ {s.targeting.genders ? (s.targeting.genders[0] === 1 ? "ชาย" : "หญิง") : "ทุกเพศ"} · placement: {s.placements}</p>
        <div className="flex flex-wrap gap-1">
          {s.interests.map((i) => <Badge key={i.id} variant="muted">{i.name}{i.audience_size_upper_bound ? ` (${fmtNum(i.audience_size_upper_bound / 1e6, 1)}M)` : ""}</Badge>)}
          {!s.interests.length && <Badge variant="warning">Broad / Advantage+ audience</Badge>}
        </div>
        {!!s.missingKeywords.length && <p className="text-xs text-amber-700">ไม่พบ interest ใน Meta: {s.missingKeywords.join(", ")}</p>}
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">targeting spec (JSON)</summary>
          <pre className="mt-1 overflow-x-auto rounded bg-muted p-2">{JSON.stringify(s.targeting, null, 2)}</pre>
        </details>
      </CardContent>
    </Card>
  );
}
