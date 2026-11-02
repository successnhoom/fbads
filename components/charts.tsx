"use client";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Metrics } from "@/lib/meta/types";

export function DailyChart({ data, currency }: { data: Array<{ date: string } & Metrics>; currency: string }) {
  const rows = data.map((d) => ({ date: d.date.slice(5), spend: Number(d.spend.toFixed(0)), results: d.results, cpa: Number(d.cpa.toFixed(0)) }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="spend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(221 83% 53%)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="hsl(221 83% 53%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" fontSize={11} />
        <YAxis yAxisId="l" fontSize={11} />
        <YAxis yAxisId="r" orientation="right" fontSize={11} />
        <Tooltip formatter={(v: number, n: string) => [n === "ใช้จ่าย" || n === "CPA" ? `${v.toLocaleString()} ${currency}` : v, n]} />
        <Legend />
        <Area yAxisId="l" type="monotone" dataKey="spend" name="ใช้จ่าย" stroke="hsl(221 83% 53%)" fill="url(#spend)" />
        <Bar yAxisId="r" dataKey="results" name="ผลลัพธ์" fill="hsl(160 84% 39%)" barSize={14} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function BreakdownChart({ data, currency }: { data: Array<{ label: string; spend: number; cpa: number }>; currency: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" fontSize={11} />
        <YAxis fontSize={11} />
        <Tooltip formatter={(v: number) => `${Number(v).toLocaleString()} ${currency}`} />
        <Legend />
        <Bar dataKey="spend" name="ใช้จ่าย" fill="hsl(221 83% 53%)" />
        <Bar dataKey="cpa" name="CPA" fill="hsl(38 92% 50%)" />
      </BarChart>
    </ResponsiveContainer>
  );
}
