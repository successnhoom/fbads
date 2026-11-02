"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Empty, ErrorBox, Loading, PageHeader } from "@/components/ui/misc";
import { api, useFetch } from "@/lib/client";
import { safeJson } from "@/lib/utils";

interface ReportRow { id: string; type: string; title: string; periodFrom: string; periodTo: string; createdAt: string; metricsJson: string }

export default function ReportsPage() {
  const { data, error, loading, reload } = useFetch<ReportRow[]>("/api/reports");
  const [type, setType] = useState<"daily" | "weekly" | "custom">("weekly");
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const r = await api<{ id: string }>("/api/ai/report", { method: "POST", json: { type, days } });
      toast.success("สร้างรายงานแล้ว");
      reload();
      window.location.href = `/reports/${r.id}`;
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="รายงานผลงาน" description="AI วิเคราะห์ตัวเลขจริงจาก Meta แล้วเขียนรายงานละเอียดพร้อมแผนปรับรอบถัดไป">
        <Select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="w-40">
          <option value="daily">รายวัน (เมื่อวาน-วันนี้)</option>
          <option value="weekly">รายสัปดาห์ (7 วัน)</option>
          <option value="custom">กำหนดเอง</option>
        </Select>
        {type === "custom" && <Input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-24" min={1} max={90} />}
        <Button onClick={generate} disabled={busy}><Sparkles /> {busy ? "AI กำลังเขียนรายงาน (1-3 นาที)..." : "สร้างรายงานด้วย AI"}</Button>
      </PageHeader>
      {error && <ErrorBox error={error} />}
      {loading && <Loading />}
      {data && !data.length && <Empty text="ยังไม่มีรายงาน กดปุ่ม สร้างรายงานด้วย AI" />}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.map((r) => {
          const m = safeJson<{ spend?: number; results?: number; cpa?: number; roas?: number }>(r.metricsJson, {});
          return (
            <Link key={r.id} href={`/reports/${r.id}`}>
              <Card className="h-full transition hover:border-primary">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> {r.title}</CardTitle>
                    <Badge variant={r.type === "daily" ? "default" : r.type === "weekly" ? "purple" : "muted"}>{r.type === "daily" ? "รายวัน" : r.type === "weekly" ? "รายสัปดาห์" : "กำหนดเอง"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  ใช้จ่าย {m.spend?.toFixed(0) ?? "-"} · ผลลัพธ์ {m.results ?? "-"} · CPA {m.cpa?.toFixed(0) ?? "-"} · ROAS {m.roas?.toFixed(2) ?? "-"}
                  <div className="mt-1 text-xs">สร้างเมื่อ {new Date(r.createdAt).toLocaleString("th-TH")}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
