import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();

export type SupabaseSession = {
  id: number;
  date: string;
  time: string;
  title: string;
  wave_direction: string;
  capacity_booked: number;
  capacity_available: number;
};

export type SupabaseRefreshLog = {
  id: number;
  refreshed_at: string;
  inserted: number;
  deleted: number;
};

async function request<T>(
  path: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<T> {
  const response = await connectors.proxy("supabase", `/rest/v1/${path}`, init);
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${details}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function listSessions(date?: string) {
  const query = date
    ? `select=*&date=eq.${encodeURIComponent(date)}&order=time.asc`
    : "select=*&order=date.asc,time.asc";
  return request<SupabaseSession[]>(`sessions?${query}`);
}

export function createSession(session: Omit<SupabaseSession, "id">) {
  return request<SupabaseSession[]>("sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(session),
  });
}

export async function deleteSessionsByDate(date: string) {
  const deleted = await request<SupabaseSession[]>(
    `sessions?date=eq.${encodeURIComponent(date)}&select=id`,
    {
      method: "DELETE",
      headers: { Prefer: "return=representation" },
    },
  );
  return deleted.length;
}

export function insertSessions(sessions: Omit<SupabaseSession, "id">[]) {
  return request<SupabaseSession[]>("sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(sessions),
  });
}

export function listRefreshLogs() {
  return request<SupabaseRefreshLog[]>(
    "refresh_log?select=*&order=refreshed_at.desc&limit=1",
  );
}

export function createRefreshLog(log: Pick<SupabaseRefreshLog, "inserted" | "deleted">) {
  return request<SupabaseRefreshLog[]>("refresh_log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(log),
  });
}