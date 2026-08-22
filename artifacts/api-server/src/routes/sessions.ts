import { Router } from "express";
import {
  ListSessionsQueryParams,
  CreateSessionBody,
  UploadSessionsBody,
  GetDailySummaryQueryParams,
  GetSessionsByHourQueryParams,
} from "@workspace/api-zod";
import {
  createRefreshLog,
  createSession,
  deleteSessionsByDate,
  insertSessions,
  listRefreshLogs,
  listSessions,
  type SupabaseSession,
} from "../lib/supabase";

const router = Router();

const IGNORE_CODES = new Set([
  "M-GENAD", "M-BAYS-SL", "M-SBUD-LEFT", "M-SBUD-RIGHT", "M-SBUD-B",
  "M-BAYS-S", "M-BAYS-GL", "M-BAYS-PL", "M-BAYS-5WK", "M-SBUD-L",
  "M-BAYS-RL", "M-RIP-GL", "M-RIP-5WK",
]);

const URBNSURF_URL =
  "https://hm42z09myi.execute-api.ap-southeast-2.amazonaws.com/prod/sessions/v1/availability";

router.get("/sessions", async (req, res) => {
  const parsed = ListSessionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  res.json(await listSessions(parsed.data.date));
});

router.post("/sessions", async (req, res) => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await createSession(parsed.data);
  res.status(201).json(row);
});

router.post("/sessions/upload", async (req, res) => {
  const parsed = UploadSessionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { rows } = parsed.data;
  const dates = [...new Set(rows.map((r) => r.date))];
  let deleted = 0;
  for (const date of dates) deleted += await deleteSessionsByDate(date);
  const inserted = rows.length ? await insertSessions(rows) : [];
  await createRefreshLog({ inserted: inserted.length, deleted });
  res.json({ inserted: inserted.length, deleted });
});

const REFRESH_COOLDOWN_MS = 3 * 60 * 1000;

router.post("/sessions/refresh", async (req, res) => {
  const [lastLog] = await listRefreshLogs();
  if (lastLog) {
    const elapsed = Date.now() - new Date(lastLog.refreshed_at).getTime();
    if (elapsed < REFRESH_COOLDOWN_MS) {
      const retryAfter = Math.ceil((REFRESH_COOLDOWN_MS - elapsed) / 1000);
      res.status(429).json({ error: "Refresh is rate-limited", retry_after_seconds: retryAfter });
      return;
    }
  }

  const tz = "Australia/Melbourne";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", { timeZone: tz });

  const fetchDay = async (date: string) => {
    const params = new URLSearchParams({
      location: "melbourne",
      from_date: date,
      to_date: date,
      page: "1",
      limit: "600",
    });
    const response = await fetch(`${URBNSURF_URL}?${params}`);
    if (!response.ok) throw new Error(`UrbnSurf API error: ${response.status}`);
    const json = await response.json() as { data?: any[] };
    return (json.data ?? []) as any[];
  };

  let raw: any[];
  try {
    const [todaySessions, tomorrowSessions] = await Promise.all([
      fetchDay(today),
      fetchDay(tomorrow),
    ]);
    raw = [...todaySessions, ...tomorrowSessions];
  } catch (err) {
    req.log.error({ err }, "Failed to fetch from UrbnSurf API");
    res.status(502).json({ error: "Failed to fetch from UrbnSurf API" });
    return;
  }

  const filtered = raw.filter((s) => !IGNORE_CODES.has(s.code));
  const grouped = new Map<string, Omit<SupabaseSession, "id">>();
  for (const s of filtered) {
    const key = `${s.date}|${s.time}|${s.title}|${s.wave_direction}`;
    const capacityTotal: number = s.capacity?.total ?? 0;
    const capacityAvailable: number = s.capacity?.available ?? 0;
    const capacityBooked = capacityTotal - capacityAvailable;
    const existing = grouped.get(key);
    if (existing) {
      existing.capacity_booked += capacityBooked;
      existing.capacity_available += capacityAvailable;
    } else {
      grouped.set(key, {
        date: s.date,
        time: s.time,
        title: s.title,
        wave_direction: s.wave_direction,
        capacity_booked: capacityBooked,
        capacity_available: capacityAvailable,
      });
    }
  }

  const rows = Array.from(grouped.values());
  let deleted = 0;
  for (const date of [today, tomorrow]) deleted += await deleteSessionsByDate(date);
  const inserted = rows.length ? await insertSessions(rows) : [];
  const refreshedAt = new Date();
  await createRefreshLog({ inserted: inserted.length, deleted });
  req.log.info({ inserted: inserted.length, deleted }, "Session refresh complete");
  res.json({ inserted: inserted.length, deleted, refreshed_at: refreshedAt.toISOString() });
});

router.get("/sessions/last-refresh", async (_req, res) => {
  const [last] = await listRefreshLogs();
  if (!last) {
    res.status(404).json({ error: "No refresh yet" });
    return;
  }
  res.json(last);
});

router.get("/sessions/dates", async (_req, res) => {
  const rows = await listSessions();
  res.json([...new Set(rows.map((row) => row.date))].sort());
});

router.get("/sessions/summary", async (req, res) => {
  const parsed = GetDailySummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "date param required" });
    return;
  }
  const rows = await listSessions(parsed.data.date);
  if (rows.length === 0) {
    res.status(404).json({ error: "No data for date" });
    return;
  }
  const total_booked = rows.reduce((sum, row) => sum + row.capacity_booked, 0);
  const total_available = rows.reduce((sum, row) => sum + row.capacity_available, 0);
  const total_capacity = total_booked + total_available;
  const occupancy_rate = total_capacity > 0 ? total_booked / total_capacity : 0;
  const hourMap: Record<string, number> = {};
  for (const row of rows) hourMap[row.time] = (hourMap[row.time] || 0) + row.capacity_booked;
  const peak_hour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const dirMap: Record<string, { booked: number; available: number }> = {};
  for (const row of rows) {
    if (!dirMap[row.wave_direction]) dirMap[row.wave_direction] = { booked: 0, available: 0 };
    dirMap[row.wave_direction].booked += row.capacity_booked;
    dirMap[row.wave_direction].available += row.capacity_available;
  }
  const wave_breakdown = Object.entries(dirMap).map(([wave_direction, values]) => ({
    wave_direction,
    total_booked: values.booked,
    total_available: values.available,
    occupancy_rate: (values.booked + values.available) > 0
      ? values.booked / (values.booked + values.available)
      : 0,
  }));
  res.json({ date: parsed.data.date, total_booked, total_available, total_capacity, occupancy_rate, peak_hour, wave_breakdown });
});

router.get("/sessions/by-hour", async (req, res) => {
  const parsed = GetSessionsByHourQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "date param required" });
    return;
  }
  const rows = await listSessions(parsed.data.date);
  const grouped: Record<string, SupabaseSession[]> = {};
  for (const row of rows) {
    if (!grouped[row.time]) grouped[row.time] = [];
    grouped[row.time].push(row);
  }
  res.json(Object.entries(grouped).map(([time, sessions]) => {
    const total_booked = sessions.reduce((sum, row) => sum + row.capacity_booked, 0);
    const total_available = sessions.reduce((sum, row) => sum + row.capacity_available, 0);
    const total_capacity = total_booked + total_available;
    return {
      time,
      sessions,
      total_booked,
      total_available,
      total_capacity,
      occupancy_rate: total_capacity > 0 ? total_booked / total_capacity : 0,
    };
  }));
});

export default router;