"use client";
import Link from "next/link";
import { CheckCircle2, Circle, ShieldAlert } from "lucide-react";
import { useFetch } from "@/lib/client";

export interface SetupStatus {
  demo: boolean; auth: boolean; db: { kind: string; persistent: boolean }; ai: boolean; secretKey: boolean; cron: boolean;
  metaApp: boolean; metaToken: boolean; realAccounts: number; blocker: string | null; hosted: boolean;
}

export function useSetup() {
  return useFetch<SetupStatus>("/api/setup");
}

/** แถบแจ้งเตือนบนแดชบอร์ด: โหมดสาธิต / ยังตั้งค่าไม่ครบ */
export function SetupBanner() {
  const { data } = useSetup();
  if (!data) return null;
  const ready = !data.demo && data.realAccounts > 0 && data.auth && data.db.persistent && data.ai;
  if (ready) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        {data.demo ? "กำลังดูโหมดสาธิต ตัวเลขเป็นข้อมูลจำลอง ยังไม่ได้ต่อบัญชีโฆษณาจริง" : "ตั้งค่ายังไม่ครบสำหรับใช้งานจริง"}
      </div>
      <Link href="/settings" className="rounded-lg bg-amber-400/20 px-3 py-1 font-medium hover:bg-amber-400/30">ดูขั้นตอนเปิดใช้งานจริง</Link>
    </div>
  );
}

/** เช็กลิสต์เปิดใช้งานจริงในหน้าตั้งค่า */
export function SetupChecklist() {
  const { data } = useSetup();
  if (!data) return null;
  const items: Array<{ done: boolean; title: string; how: string }> = [
    { done: data.auth, title: "ตั้งรหัสเข้าเว็บ", how: "เพิ่ม APP_PASSWORD = รหัสที่คุณตั้งเอง (คนที่ไม่มีรหัสจะเข้าไม่ได้)" },
    { done: data.secretKey, title: "ตั้งคีย์เข้ารหัส token", how: "เพิ่ม APP_SECRET_KEY = ตัวอักษรสุ่มยาว 32 ตัวขึ้นไป" },
    { done: data.db.persistent, title: "ฐานข้อมูลถาวร", how: data.hosted ? "ใน Vercel เปิดแท็บ Storage → Create Database → Neon (Postgres ฟรี) → Connect กับโปรเจกต์นี้" : "ใช้ไฟล์ SQLite ในเครื่องได้เลย หรือตั้ง DATABASE_URL เป็น postgres://" },
    { done: data.ai, title: "เปิดสมอง AI (Claude)", how: "เพิ่ม ANTHROPIC_API_KEY จาก platform.claude.com (ใช้กับวิเคราะห์เชิงลึก วางแผน หากลุ่มเป้าหมาย รายงาน)" },
    { done: data.realAccounts > 0, title: "เชื่อมบัญชีโฆษณาจริง", how: "เพิ่ม META_ACCESS_TOKEN (แอปจะเชื่อมให้อัตโนมัติ) หรือวาง token ในช่อง วิธีที่ 2 ด้านล่าง" },
    { done: !data.demo, title: "ปิดโหมดสาธิต", how: "ปิดเองอัตโนมัติเมื่อตั้ง META_ACCESS_TOKEN หรือเพิ่ม DEMO_MODE = 0" },
    { done: data.cron, title: "ให้ AI ทำงานเองทุกวัน (ไม่บังคับ)", how: "เพิ่ม CRON_SECRET = ตัวอักษรสุ่ม แล้วเปิดออโต้ในหน้า ออโต้ปรับงบ" },
  ];
  const doneCount = items.filter((i) => i.done).length;
  return (
    <div className="glass-strong rounded-3xl p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold">เช็กลิสต์เปิดใช้งานจริง</h2>
        <span className="text-sm text-muted-foreground">{doneCount}/{items.length}</span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {data.hosted ? "ตั้งค่าทั้งหมดที่ Vercel → โปรเจกต์ → Settings → Environment Variables แล้วกด Redeploy หนึ่งครั้ง" : "ตั้งค่าในไฟล์ .env แล้วรีสตาร์ตแอป"}
      </p>
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.title} className={`flex gap-3 rounded-xl border px-3 py-2 ${i.done ? "border-emerald-400/20 bg-emerald-500/5" : "border-white/10 bg-white/5"}`}>
            {i.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
            <div>
              <div className="text-sm font-medium">{i.title}</div>
              {!i.done && <div className="text-xs text-muted-foreground">{i.how}</div>}
            </div>
          </div>
        ))}
      </div>
      {data.blocker && <p className="mt-3 text-xs text-amber-300">{data.blocker}</p>}
    </div>
  );
}
