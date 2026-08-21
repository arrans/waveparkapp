import { Router } from "express";
import { db, sessionsTable, refreshLogTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  ListSessionsQueryParams,
  CreateSessionBody,
  UploadSessionsBody,
  GetDailySummaryQueryParams,
  GetSessionsByHourQueryParams,
} from "@workspace/api-zod";

const router = Router();

const IGNORE_CODES = new Set([
  "M-GENAD", "M-BAYS-SL", "M-SBUD-LEFT", "M-SBUD-RIGHT", "M-SBUD-B",
  "M-BAYS-S", "M-BAYS-GL", "M-BAYS-PL", "M-BAYS-5WK", "M-SBUD-L",
  "M-BAYS-RL", "M-RIP-GL", "M-RIP-5WK",
]);

const URBNSURF_URL =
  "https://hm42z09myi.execute-api.ap-southeast-2.amazonaws.com/prod/sessions/v1/availability";

// GET /sessions
router.get("/sessions", async (req, res) => {
  const parsed = ListSessionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { date } = parsed.data;
  const rows = date
    ? await db.select().from(sessionsTable).where(eq(sessionsTable.date, date)).orderBy(sessionsTable.time)
    : await db.select().from(sessionsTable).orderBy(sessionsTable.date, sessionsTable.time);
  res.json(rows);
});

// POST /sessions
router.post("/sessions", async (req, res) => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await db.insert(sessionsTable).values(parsed.data).returning();
  res.status(201).json(row);
});

// POST /sessions/upload
router.post("/sessions/upload", async (req, res) => {
  const parsed = UploadSessionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { rows } = parsed.data;

  const dates = [...new Set(rows.map((r) => r.date))];

  let deleted = 0;
  for (const d of dates) {
    const result = await db.delete(sessionsTable).where(eq(sessionsTable.date, d)).returning();
    deleted += result.length;
  }

  const inserted = rows.length > 0
    ? await db.insert(sessionsTable).values(rows).returning()
    : [];

  // Log upload as a refresh event
  await db.insert(refreshLogTable).values({ inserted: inserted.length, deleted });

  res.json({ inserted: inserted.length, deleted });
});

const REFRESH_COOLDOWN_MS = 3 * 60 * 1000;

// POST /sessions/refresh — fetches live data from UrbnSurf API
router.post("/sessions/refresh", async (req, res) => {
  // Global cooldown — reject if any user refreshed in the last 3 minutes
  const [lastLog] = await db.select().from(refreshLogTable).orderBy(desc(refreshLogTable.refreshedAt)).limit(1);
  if (lastLog) {
    const elapsed = Date.now() - new Date(lastLog.refreshedAt).getTime();
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

  // Filter out ignored session codes
  const filtered = raw.filter((s) => !IGNORE_CODES.has(s.code));

  // Group by date+time+title+wave_direction, summing capacities
  const grouped = new Map<
    string,
    { date: string; time: string; title: string; wave_direction: string; capacity_booked: number; capacity_available: number }
  >();

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

  // Delete existing rows for today and tomorrow, then insert fresh data
  let deleted = 0;
  for (const d of [today, tomorrow]) {
    const result = await db.delete(sessionsTable).where(eq(sessionsTable.date, d)).returning();
    deleted += result.length;
  }

  const inserted = rows.length > 0
    ? await db.insert(sessionsTable).values(rows).returning()
    : [];

  const refreshedAt = new Date();
  await db.insert(refreshLogTable).values({ inserted: inserted.length, deleted });

  req.log.info({ inserted: inserted.length, deleted }, "Session refresh complete");
  res.json({ inserted: inserted.length, deleted, refreshed_at: refreshedAt.toISOString() });
});

// GET /sessions/last-refresh
router.get("/sessions/last-refresh", async (_req, res) => {
  const [last] = await db
    .select()
    .from(refreshLogTable)
    .orderBy(desc(refreshLogTable.refreshedAt))
    .limit(1);

  if (!last) {
    res.status(404).json({ error: "No refresh yet" });
    return;
  }

  res.json({
    refreshed_at: last.refreshedAt.toISOString(),
    inserted: last.inserted,
    deleted: last.deleted,
  });
});

// GET /sessions/dates
router.get("/sessions/dates", async (_req, res) => {
  const rows = await db
    .selectDistinct({ date: sessionsTable.date })
    .from(sessionsTable)
    .orderBy(sessionsTable.date);
  res.json(rows.map((r) => r.date));
});

// GET /sessions/summary
router.get("/sessions/summary", async (req, res) => {
  const parsed = GetDailySummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "date param required" });
    return;
  }
  const { date } = parsed.data;
  const rows = await db.select().from(sessionsTable).where(eq(sessionsTable.date, date));

  if (rows.length === 0) {
    res.status(404).json({ error: "No data for date" });
    return;
  }

  const total_booked = rows.reduce((s, r) => s + r.capacity_booked, 0);
  const total_available = rows.reduce((s, r) => s + r.capacity_available, 0);
  const total_capacity = total_booked + total_available;
  const occupancy_rate = total_capacity > 0 ? total_booked / total_capacity : 0;

  const hourMap: Record<string, number> = {};
  for (const r of rows) {
    hourMap[r.time] = (hourMap[r.time] || 0) + r.capacity_booked;
  }
  const peak_hour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const dirMap: Record<string, { booked: number; available: number }> = {};
  for (const r of rows) {
    if (!dirMap[r.wave_direction]) dirMap[r.wave_direction] = { booked: 0, available: 0 };
    dirMap[r.wave_direction].booked += r.capacity_booked;
    dirMap[r.wave_direction].available += r.capacity_available;
  }
  const wave_breakdown = Object.entries(dirMap).map(([wave_direction, s]) => ({
    wave_direction,
    total_booked: s.booked,
    total_available: s.available,
    occupancy_rate: (s.booked + s.available) > 0 ? s.booked / (s.booked + s.available) : 0,
  }));

  res.json({ date, total_booked, total_available, total_capacity, occupancy_rate, peak_hour, wave_breakdown });
});

// GET /sessions/by-hour
router.get("/sessions/by-hour", async (req, res) => {
  const parsed = GetSessionsByHourQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "date param required" });
    return;
  }
  const { date } = parsed.data;
  const rows = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.date, date))
    .orderBy(sessionsTable.time);

  const grouped: Record<string, typeof rows> = {};
  for (const r of rows) {
    if (!grouped[r.time]) grouped[r.time] = [];
    grouped[r.time].push(r);
  }

  const result = Object.entries(grouped).map(([time, sessions]) => {
    const total_booked = sessions.reduce((s, r) => s + r.capacity_booked, 0);
    const total_available = sessions.reduce((s, r) => s + r.capacity_available, 0);
    const total_capacity = total_booked + total_available;
    const occupancy_rate = total_capacity > 0 ? total_booked / total_capacity : 0;
    return { time, sessions, total_booked, total_available, total_capacity, occupancy_rate };
  });

  res.json(result);
});

export default router;
