"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, useFetch, type AccountInfo } from "@/lib/client";

export function AccountSwitcher() {
  const router = useRouter();
  const { data, reload } = useFetch<AccountInfo[]>("/api/accounts");
  if (!data) return null;
  if (!data.length) return <div className="rounded-md bg-slate-800 px-3 py-2 text-xs text-slate-300">ยังไม่ได้เชื่อมต่อบัญชี</div>;
  const active = data.find((a) => a.isActive) || data[0];
  return (
    <select
      className="w-full rounded-md bg-slate-800 px-2 py-2 text-xs text-white"
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
        <option key={a.id} value={a.id}>
          {a.name} ({a.currency})
        </option>
      ))}
    </select>
  );
}
