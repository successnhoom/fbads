import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtMoney(n: number | null | undefined, currency = "THB") {
  if (n == null || Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

export function fmtNum(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: digits }).format(n);
}

export function fmtPct(n: number | null | undefined, digits = 2) {
  if (n == null || Number.isNaN(n)) return "-";
  return `${n.toFixed(digits)}%`;
}

export function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function daysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return isoDate(d);
}
