"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, useFetch, type AccountInfo } from "@/lib/client";

export function AccountSwitcher() {
  const router = useRouter();
  const { data, reload } = useFetch<AccountInfo[]>("/api/accounts");
  if (!data) return null;
  if (!data.length) return <div className="rounded-xl glass px-3 py-2 text-xs text-muted-foreground">ยังไม่ได้เชื่อมต่อบัญชี</div>;
  const active = data.find((a) => a.isActive) || data[0];
  return (
    <select
      className="w-full rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary"
      value={active.id}
      onChange={async (e) => {
        try {
          await api("/api/accounts/active", { method: "POST", json: { id: e.target.value } });
          reload();
          router.refresh();
          window.location.reload();
        } catch (err) {
          toast.error((err as Error).message);
        }
      }}
    >
      {data.map((a) => (
        <option key={a.id} value={a.id} className="bg-slate-900">
          {a.name} ({a.currency})
        </option>
      ))}
    </select>
  );
}
