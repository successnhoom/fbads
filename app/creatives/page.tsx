"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/misc";
import { api } from "@/lib/client";
import type { CreativeSet } from "@/lib/ai/creative";

export default function CreativesPage() {
  const [form, setForm] = useState({ product: "", audience: "", angle: "", goal: "ยอดขาย", offer: "", tone: "", count: 4 });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CreativeSet | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      setResult(await api<CreativeSet>("/api/ai/creative", { method: "POST", json: form }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("คัดลอกแล้ว"); };

  return (
    <div>
      <PageHeader title="AI เขียนข้อความโฆษณา" description="สร้าง Primary text / Headline / Description หลายมุม พร้อมแนะนำภาพ" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>บรีฟ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="สินค้า / บริการ *"><Textarea value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} /></Field>
            <Field label="กลุ่มเป้าหมาย"><Input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="เช่น แม่บ้าน 30-45 ที่อยากประหยัดเวลา" /></Field>
            <Field label="ข้อเสนอ / โปรโมชัน"><Input value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} placeholder="ซื้อ 1 แถม 1 / ส่งฟรี" /></Field>
            <Field label="มุมที่อยากเน้น"><Input value={form.angle} onChange={(e) => setForm({ ...form, angle: e.target.value })} placeholder="pain point / รีวิว / ความคุ้ม" /></Field>
            <Field label="โทน"><Input value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} placeholder="เป็นกันเอง / พรีเมียม / ตลก" /></Field>
            <Field label="จำนวนแบบ"><Input type="number" min={3} max={6} value={form.count} onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} /></Field>
            <Button className="w-full" onClick={run} disabled={busy || form.product.length < 3}><Sparkles /> {busy ? "AI กำลังเขียน..." : "ให้ AI เขียนแอด"}</Button>
          </CardContent>
        </Card>
        <div className="space-y-4 lg:col-span-2">
          {result && <Card><CardContent className="p-4 text-sm"><b>กลยุทธ์:</b> {result.strategy}</CardContent></Card>}
          {result?.variants.map((v, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>แบบที่ {i + 1}: {v.angle}</CardTitle>
                  <Badge variant="default">{v.call_to_action}</Badge>
                </div>
                <CardDescription>ภาพแนะนำ: {v.visual_direction}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="rounded-md bg-muted p-3 whitespace-pre-wrap">{v.primary_text}<Button size="sm" variant="ghost" className="ml-2" onClick={() => copy(v.primary_text)}><Copy /></Button></div>
                <div><b>Headline:</b> {v.headline} <Button size="sm" variant="ghost" onClick={() => copy(v.headline)}><Copy /></Button></div>
                <div><b>Description:</b> {v.description}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
