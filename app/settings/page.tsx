"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Facebook, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/misc";
import { api, useFetch, type AccountInfo } from "@/lib/client";

function SettingsInner() {
  const sp = useSearchParams();
  const { data: accounts, reload } = useFetch<AccountInfo[]>("/api/accounts");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const active = accounts?.find((a) => a.isActive) || accounts?.[0];
  const { data: meta } = useFetch<{ pages: Array<{ id: string; name: string }>; pixels: Array<{ id: string; name: string }>; audiences: Array<{ id: string; name: string; subtype: string; approximate_count_lower_bound?: number }> }>(active ? `/api/accounts/meta?accountId=${active.id}` : null, [active?.id]);
  const [pageId, setPageId] = useState("");
  const [pixelId, setPixelId] = useState("");

  useEffect(() => {
    if (sp.get("connected")) toast.success(sp.get("connected"));
    if (sp.get("error")) toast.error(sp.get("error"));
  }, [sp]);
  useEffect(() => {
    setPageId(active?.pageId || "");
    setPixelId(active?.pixelId || "");
  }, [active?.id, active?.pageId, active?.pixelId]);

  const connectToken = async () => {
    setBusy(true);
    try {
      const r = await api<{ count: number }>("/api/accounts/connect", { method: "POST", json: { token } });
      toast.success(`เชื่อมต่อสำเร็จ ${r.count} บัญชี`);
      setToken("");
      reload();
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const savePagePixel = async () => {
    if (!active) return;
    try {
      await api("/api/accounts", { method: "PATCH", json: { id: active.id, pageId: pageId || null, pixelId: pixelId || null } });
      toast.success("บันทึกแล้ว");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("ลบบัญชีนี้ออกจากระบบ (ไม่กระทบบัญชีจริงใน Facebook)?")) return;
    await api("/api/accounts", { method: "DELETE", json: { id } });
    reload();
    window.location.reload();
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title="ตั้งค่า / เชื่อมต่อบัญชี" description="เชื่อมต่อบัญชีโฆษณา Facebook จริง เลือกเพจและพิกเซลสำหรับสร้างแคมเปญ" />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>วิธีที่ 1: ล็อกอินด้วย Facebook</CardTitle>
            <CardDescription>ต้องตั้งค่า META_APP_ID / META_APP_SECRET และใส่ Redirect URI <code className="text-xs">{typeof window !== "undefined" ? window.location.origin : ""}/api/auth/facebook/callback</code> ในแอป Facebook</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/api/auth/facebook"><Facebook /> เชื่อมต่อด้วย Facebook</a>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>วิธีที่ 2: ใส่ Access Token</CardTitle>
            <CardDescription>System User token จาก Business Settings (แนะนำ ไม่หมดอายุ) หรือ token จาก Graph API Explorer ที่มีสิทธิ์ ads_management, ads_read, business_management, pages_show_list</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="EAAB..." value={token} onChange={(e) => setToken(e.target.value)} />
            <Button onClick={connectToken} disabled={busy || !token}>{busy ? "กำลังตรวจสอบ..." : "เชื่อมต่อด้วย token"}</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>บัญชีที่เชื่อมต่อแล้ว</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!accounts?.length && <p className="text-sm text-muted-foreground">ยังไม่มีบัญชี</p>}
          {accounts?.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
              <div>
                <div className="font-medium">{a.name} {a.isActive && <Badge variant="success">ใช้งานอยู่</Badge>}</div>
                <div className="text-xs text-muted-foreground">{a.id} · {a.currency} · {a.timezone}{a.businessName ? ` · ${a.businessName}` : ""}{a.tokenExpiresAt ? ` · token หมดอายุ ${new Date(a.tokenExpiresAt).toLocaleDateString("th-TH")}` : ""}</div>
              </div>
              <div className="flex gap-2">
                {!a.isActive && <Button size="sm" variant="outline" onClick={async () => { await api("/api/accounts/active", { method: "POST", json: { id: a.id } }); window.location.reload(); }}>ใช้บัญชีนี้</Button>}
                <Button size="sm" variant="ghost" onClick={() => remove(a.id)}><Trash2 /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {active && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>เพจและพิกเซลของบัญชี {active.name}</CardTitle>
            <CardDescription>ใช้ตอน AI สร้างแคมเปญจริง (เพจจำเป็น, พิกเซลจำเป็นสำหรับแคมเปญยอดขาย)</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Field label="เพจ Facebook">
              <Select value={pageId} onChange={(e) => setPageId(e.target.value)}>
                <option value="">— เลือกเพจ —</option>
                {meta?.pages.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
              </Select>
            </Field>
            <Field label="Pixel">
              <Select value={pixelId} onChange={(e) => setPixelId(e.target.value)}>
                <option value="">— ไม่ใช้ —</option>
                {meta?.pixels.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
              </Select>
            </Field>
            {!meta?.pages.length && <p className="text-xs text-amber-700 md:col-span-2">ไม่พบเพจ – token อาจไม่มีสิทธิ์ pages_show_list หรือพิมพ์ page ID เองได้ในช่องด้านล่าง</p>}
            <Field label="หรือพิมพ์ Page ID เอง"><Input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="1234567890" /></Field>
            <Field label="หรือพิมพ์ Pixel ID เอง"><Input value={pixelId} onChange={(e) => setPixelId(e.target.value)} placeholder="1234567890" /></Field>
            <div className="md:col-span-2"><Button onClick={savePagePixel}>บันทึก</Button></div>
            {!!meta?.audiences?.length && (
              <div className="md:col-span-2 text-xs text-muted-foreground">
                Custom audiences ในบัญชี: {meta.audiences.slice(0, 10).map((a) => `${a.name} (${a.subtype})`).join(", ")}{meta.audiences.length > 10 ? " ..." : ""}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader><CardTitle>ตั้งเวลาให้ AI ทำงานอัตโนมัติ</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>ระบบมี endpoint สำหรับ cron (ต้องส่ง header <code>Authorization: Bearer CRON_SECRET</code> หรือ <code>?secret=</code>):</p>
          <ul className="list-disc pl-5">
            <li><code>GET /api/cron/optimize</code> – รันรอบปรับงบทุกบัญชีที่เปิดออโต้</li>
            <li><code>GET /api/cron/report?type=daily</code> – สร้างรายงานรายวัน</li>
            <li><code>GET /api/cron/report?type=weekly</code> – สร้างรายงานรายสัปดาห์</li>
          </ul>
          <p>ถ้า deploy บน Vercel ไฟล์ <code>vercel.json</code> ตั้งเวลาไว้ให้แล้ว (ตี 2 ทุกวัน / ทุกวันจันทร์) หรือใช้ cron-job.org, GitHub Actions ก็ได้</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsInner />
    </Suspense>
  );
}
