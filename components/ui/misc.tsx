"use client";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

export function Loading({ text = "กำลังโหลด..." }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
      <Spinner /> {text}
    </div>
  );
}

export function ErrorBox({ error }: { error: string }) {
  return <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>;
}

export function Empty({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>;
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition", checked ? "bg-primary" : "bg-muted-foreground/30")}
      >
        <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition", checked ? "translate-x-4" : "translate-x-0.5")} />
      </span>
      {label}
    </label>
  );
}
