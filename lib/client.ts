"use client";
import { useCallback, useEffect, useState } from "react";

export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const body = (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as { ok: boolean; data?: T; error?: string };
  if (!res.ok || !body.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body.data as T;
}

export function useFetch<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const reload = useCallback(() => {
    if (!path) return;
    setLoading(true);
    setError(null);
    api<T>(path)
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}

export interface AccountInfo {
  id: string; name: string; currency: string; timezone: string; isActive: boolean; pageId?: string | null; pixelId?: string | null;
  businessName?: string | null; tokenExpiresAt?: string | null; automationEnabled: boolean;
}
