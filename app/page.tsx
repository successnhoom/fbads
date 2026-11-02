"use client";
import Link from "next/link";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { Empty, ErrorBox, Loading, PageHeader } from "@/components/ui/misc";
import { KpiGrid, resultLabel } from "@/components/metrics";
import { DailyChart } from "@/components/charts";
import { PendingActions } from "@/components/pending-actions";
import { useFetch } from "@/lib/client";
import type { AccountSnapshot } from "@/lib/meta/data";
import { fmtMoney, fmtNum, fmtPct } from "@/lib/utils";

export default function Dashboard() {
  const [days, setDays] = useState(7);
  const { data, error, loading, reload } = useFetch<{ account: { id: string; name: string; currency: string }; snapshot: AccountSnapshot }>(`/api/overview?days=${days}`);

  if (error) {
    const notConnected = error.includes("ยังไม่ได้เชื่อมต่อ");
    return (
      <div>
        <PageHeader title="แดชบอร์ด" />
        <ErrorBox error={error} />
        {notConnected && (
          <Button asChild className="mt-4">
            <Link href="/settings">ไปเชื่อมต่อบัญชีโฆษณา</Link>
          </Button>
        )}
      </div>
    );
  }
  if (loading || !data) return <Loading text="กำลังดึงข้อมูลจาก Meta..." />;
  const { snapshot: s, account } = data;
  const cur = account.currency;
  const topAdsets = [...s.adsets].filter((a) => a.metrics.spend > 0).sort((a, b) => b.metrics.spend - a.metrics.spend).slice(0, 8);

  return (
    <div>
      <PageHeader title={`แดชบอร์ด – ${account.name}`} description={`ข้อมูล ${s.since} ถึง ${s.until} (เทียบกับ ${s.prevSince} ถึง ${s.prevUntil})`}>
        <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-36">
          <option value={1}>วันนี้</option>
          <option value={3}>3 วัน</option>
          <option value={7}>7 วัน</option>
          <option value={14}>14 วัน</option>
          <option value={30}>30 วัน</option>
        </Select>
        <Button variant="outline" size="sm" onClick={reload}>
          <RefreshCw /> รีเฟรช
        </Button>
      </PageHeader>

      <KpiGrid m={s.account.metrics} prev={s.account.prevMetrics} currency={cur} />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>ค่าใช้จ่ายและผลลัพธ์รายวัน</CardTitle>
          </CardHeader>
          <CardContent>{s.account.daily?.length ? <DailyChart data={s.account.daily} currency={cur} /> : <Empty text="ยังไม่มีข้อมูลในช่วงนี้" />}</CardContent>
        </Card>
        <PendingActions />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>แคมเปญ</CardTitle>
        </CardHeader>
        <CardContent>
          {s.campaigns.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>แคมเปญ</Th><Th>สถานะ</Th><Th>งบ/วัน</Th><Th className="text-right">ใช้จ่าย</Th><Th className="text-right">ผลลัพธ์</Th><Th className="text-right">CPA</Th><Th className="text-right">ROAS</Th><Th className="text-right">CTR</Th>
                </tr>
              </thead>
              <tbody>
                {s.campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/40">
                    <Td className="font-medium">{c.name}<div className="text-xs text-muted-foreground">{c.objective}</div></Td>
                    <Td><StatusBadge status={c.effectiveStatus} /></Td>
                    <Td>{c.dailyBudget ? fmtMoney(c.dailyBudget, cur) : <span className="text-muted-foreground">ระดับ ad set</span>}</Td>
                    <Td className="text-right">{fmtMoney(c.metrics.spend, cur)}</Td>
                    <Td className="text-right">{fmtNum(c.metrics.results)} <span className="text-xs text-muted-foreground">{resultLabel(c.metrics.resultType)}</span></Td>
                    <Td className="text-right">{c.metrics.cpa ? fmtMoney(c.metrics.cpa, cur) : "-"}</Td>
                    <Td className="text-right">{c.metrics.roas ? `${c.metrics.roas.toFixed(2)}x` : "-"}</Td>
                    <Td className="text-right">{fmtPct(c.metrics.ctr)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty text="ยังไม่มีแคมเปญในบัญชีนี้ – ลองให้ AI วางแผนแคมเปญแรกได้ที่เมนู AI วางแผนแคมเปญ" />
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Ad set ที่ใช้งบมากที่สุด</CardTitle>
        </CardHeader>
        <CardContent>
          {topAdsets.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Ad set</Th><Th>สถานะ</Th><Th>งบ/วัน</Th><Th className="text-right">ใช้จ่าย</Th><Th className="text-right">ผลลัพธ์</Th><Th className="text-right">CPA</Th><Th className="text-right">CTR</Th><Th className="text-right">Freq.</Th>
                </tr>
              </thead>
              <tbody>
                {topAdsets.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/40">
                    <Td className="font-medium">{a.name}<div className="text-xs text-muted-foreground">{a.campaignName}</div></Td>
                    <Td><StatusBadge status={a.effectiveStatus} /></Td>
                    <Td>{a.dailyBudget ? fmtMoney(a.dailyBudget, cur) : "-"}</Td>
                    <Td className="text-right">{fmtMoney(a.metrics.spend, cur)}</Td>
                    <Td className="text-right">{fmtNum(a.metrics.results)}</Td>
                    <Td className="text-right">{a.metrics.cpa ? fmtMoney(a.metrics.cpa, cur) : "-"}</Td>
                    <Td className="text-right">{fmtPct(a.metrics.ctr)}</Td>
                    <Td className="text-right">{a.metrics.frequency.toFixed(2)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty text="ไม่มี ad set ที่ใช้งบในช่วงนี้" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
