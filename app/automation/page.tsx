"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bot, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { ActionBadge, StateBadge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { Empty, ErrorBox, Loading, PageHeader, Switch } from "@/components/ui/misc";
import { api, useFetch } from "@/lib/client";
import type { ActionLog, AutomationSettings } from "@prisma/client";
import type { RunSummary } from "@/lib/automation/run";
import { safeJson } from "@/lib/utils";

export default function AutomationPage() {
  const { data: settings, error, loading, setData } = useFetch<AutomationSettings>("/api/automation/settings");
  const { data: actions, reload: reloadActions } = useFetch<ActionLog[]>("/api/automation/actions?limit=100");
  const [form, setForm] = useState<Partial<AutomationSettings>>({});
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<RunSummary | null>(null);
  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const num = (k: keyof AutomationSettings, nullable = false) => ({
    value: form[k] == null ? "" : String(form[k]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value === "" ? (nullable ? null : 0) : Number(e.target.value) }),
    type: "number" as const,
  });

  const save = async () => {
    setSaving(true);
    try {
      const { accountId, updatedAt, ...rest } = form as AutomationSettings;
      void accountId; void updatedAt;
      const s = await api<AutomationSettings>("/api/automation/settings", { method: "PUT", json: rest });
      setData(s);
      toast.success("บันทึกการตั้งค่าแล้ว");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    setRunning(true);
    try {
      const s = await api<RunSummary>("/api/automation/run", { method: "POST", json: {} });
      setLast(s);
      toast.success(`AI วิเคราะห์เสร็จ: เสนอ ${s.proposed} รายการ`);
      reloadActions();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const decide = async (id: string, decision: "approve" | "reject") => {
    try {
      await api(`/api/automation/actions/${id}`, { method: "POST", json: { decision } });
      reloadActions();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (error) return <div><PageHeader title="ออโต้ปรับงบ" /><ErrorBox error={error} /></div>;
  if (loading || !settings) return <Loading />;

  return (
    <div>
      <PageHeader title="AI ออโต้ปรับงบ / หยุด-เปิด Ad set" description="AI วิเคราะห์ตัวเลขทุกรอบ ตัดสินใจย้ายงบจากตัวแย่ไปตัวดี ภายใต้เพดานที่คุณกำหนด">
        <Button onClick={run} disabled={running}><Play /> {running ? "AI กำลังวิเคราะห์ (1-2 นาที)..." : "รันวิเคราะห์ตอนนี้"}</Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>กฎและเพดาน (Guardrails)</CardTitle>
            <CardDescription>AI จะไม่ทำเกินกรอบนี้ไม่ว่ากรณีใด</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 flex flex-wrap gap-6">
              <Switch checked={!!form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} label="เปิดออโต้เมชัน (รันตามเวลา cron)" />
              <Field label="โหมด">
                <Select value={form.mode || "approve"} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                  <option value="approve">เสนอแล้วรอให้ฉันอนุมัติ (ปลอดภัย)</option>
                  <option value="auto">ทำทันทีอัตโนมัติ</option>
                </Select>
              </Field>
            </div>
            <Field label="เพดานงบรวมต่อวัน" hint="ผลรวมงบ ad set ที่เปิดอยู่ต้องไม่เกิน"><Input {...num("dailyBudgetCap")} /></Field>
            <Field label="ปรับงบได้สูงสุดต่อรอบ (%)" hint="แนะนำ 15-25% เพื่อไม่ให้ learning รีเซ็ต"><Input {...num("maxChangePct")} /></Field>
            <Field label="Target CPA (ต้นทุนต่อผลลัพธ์)" hint="เว้นว่างถ้าไม่ใช้"><Input {...num("targetCpa", true)} /></Field>
            <Field label="Target ROAS" hint="เช่น 3 = ขายได้ 3 เท่าของค่าแอด"><Input {...num("targetRoas", true)} step="0.1" /></Field>
            <Field label="ใช้จ่ายขั้นต่ำก่อนตัดสิน" hint="ad set ที่ใช้น้อยกว่านี้ = ยังเรียนรู้ ไม่แตะ"><Input {...num("minSpendToJudge")} /></Field>
            <Field label="หยุดเมื่อ CPA เกิน (เท่าของ target)" hint="เช่น 2 = หยุดถ้า CPA แพงกว่าเป้า 2 เท่า"><Input {...num("pauseWhenCpaOver", true)} step="0.1" /></Field>
            <Field label="งบ ad set ต่ำสุด"><Input {...num("minAdsetBudget")} /></Field>
            <Field label="งบ ad set สูงสุด"><Input {...num("maxAdsetBudget")} /></Field>
            <Field label="ดูข้อมูลย้อนหลัง (วัน)"><Input {...num("lookbackDays")} /></Field>
            <Field label="Webhook แจ้งเตือน (ไม่บังคับ)" hint="Discord / Slack / Make / n8n – ส่ง JSON {text, content}">
              <Input value={form.notifyWebhookUrl || ""} onChange={(e) => setForm({ ...form, notifyWebhookUrl: e.target.value })} placeholder="https://..." />
            </Field>
            <div className="md:col-span-2"><Button onClick={save} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}</Button></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4" /> ผลวิเคราะห์ล่าสุด</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!last && <p className="text-muted-foreground">กด "รันวิเคราะห์ตอนนี้" เพื่อให้ AI ดูบัญชี</p>}
            {last && (
              <>
                <p>{last.assessment}</p>
                <p className="text-xs text-muted-foreground">เสนอ {last.proposed} · ทำแล้ว {last.applied} · รออนุมัติ {last.pending} · ล้มเหลว {last.failed}</p>
                {!!last.watchlist.length && <div><div className="font-medium">จับตา</div><ul className="list-disc pl-5 text-xs">{last.watchlist.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
                {!!last.creativeNotes.length && <div><div className="font-medium">ข้อสังเกตครีเอทีฟ/กลุ่มเป้าหมาย</div><ul className="list-disc pl-5 text-xs">{last.creativeNotes.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>ประวัติการตัดสินใจของ AI</CardTitle></CardHeader>
        <CardContent>
          {!actions?.length ? <Empty text="ยังไม่มีประวัติ" /> : (
            <Table>
              <thead><tr><Th>เวลา</Th><Th>รายการ</Th><Th>การกระทำ</Th><Th>งบ</Th><Th>เหตุผล</Th><Th>มั่นใจ</Th><Th>สถานะ</Th><Th></Th></tr></thead>
              <tbody>
                {actions.map((a) => {
                  const b = safeJson<{ dailyBudget?: number }>(a.beforeJson, {});
                  const af = safeJson<{ dailyBudget?: number }>(a.afterJson, {});
                  return (
                    <tr key={a.id} className="hover:bg-muted/40">
                      <Td className="whitespace-nowrap text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString("th-TH")}</Td>
                      <Td className="font-medium">{a.entityName}<div className="text-xs text-muted-foreground">{a.entityType}</div></Td>
                      <Td><ActionBadge type={a.actionType} /></Td>
                      <Td className="whitespace-nowrap text-xs">{b.dailyBudget != null && af.dailyBudget != null && b.dailyBudget !== af.dailyBudget ? `${b.dailyBudget} → ${af.dailyBudget}` : ""}</Td>
                      <Td className="max-w-md text-xs">{a.reason}{a.error && <div className="text-red-600">{a.error}</div>}</Td>
                      <Td className="text-xs">{a.confidence != null ? `${Math.round(a.confidence * 100)}%` : ""}</Td>
                      <Td><StateBadge status={a.status} /></Td>
                      <Td>
                        {a.status === "pending" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="success" onClick={() => decide(a.id, "approve")}>อนุมัติ</Button>
                            <Button size="sm" variant="outline" onClick={() => decide(a.id, "reject")}>ไม่</Button>
                          </div>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
