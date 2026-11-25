"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const sp = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || "เข้าสู่ระบบไม่สำเร็จ");
      const next = sp.get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <form onSubmit={submit} className="glass-strong w-full max-w-sm space-y-4 rounded-3xl p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 shadow-lg shadow-violet-500/30">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-semibold"><span className="text-gradient">AI Ads Expert</span></h1>
          <p className="text-sm text-muted-foreground">ใส่รหัสผ่านเพื่อเข้าแดชบอร์ด</p>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="รหัสผ่าน" className="h-11 pl-9" />
        </div>
        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-center text-sm text-rose-200">{error}</div>}
        <Button type="submit" className="h-11 w-full bg-gradient-to-r from-violet-600 to-fuchsia-600" disabled={busy || !password}>
          {busy ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
