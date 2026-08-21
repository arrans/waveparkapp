const SESSION_COLORS: Record<string, string> = {
  "Cruiser": "rgb(70, 190, 176)",
  "Pro Turns": "rgb(255, 150, 145)",
  "Progressive Turns": "rgb(51, 117, 125)",
  "Advanced Turns": "rgb(210, 175, 255)",
  "Intermediate": "rgb(69, 124, 175)",
  "Advanced": "rgb(246, 180, 64)",
};

const HOURS = [
  { time: "11:00", title: "Cruiser",           fill: 16, left: { booked: 2,  total: 18 }, right: { booked: 5,  total: 18 } },
  { time: "12:00", title: "Pro Turns",          fill: 50, left: { booked: 1,  total: 12 }, right: { booked: 11, total: 12 } },
  { time: "13:00", title: "Progressive Turns",  fill: 36, left: { booked: 3,  total: 18 }, right: { booked: 10, total: 18 } },
  { time: "14:00", title: "Advanced Turns",     fill: 58, left: { booked: 4,  total: 18 }, right: { booked: 17, total: 18 } },
  { time: "15:00", title: "Intermediate",       fill: 44, left: { booked: 4,  total: 18 }, right: { booked: 12, total: 18 } },
  { time: "16:00", title: "Advanced",           fill: 42, left: { booked: 4,  total: 18 }, right: { booked: 11, total: 18 } },
  { time: "17:00", title: "Progressive Turns",  fill: 22, left: { booked: 2,  total: 18 }, right: { booked: 6,  total: 18 } },
  { time: "18:00", title: "Intermediate",       fill: 69, left: { booked: 8,  total: 18 }, right: { booked: 16, total: 18 } },
  { time: "19:00", title: "Cruiser",            fill: 42, left: { booked: 6,  total: 18 }, right: { booked: 9,  total: 18 } },
  { time: "20:00", title: "Advanced",           fill: 28, left: { booked: 5,  total: 18 }, right: { booked: 5,  total: 18 } },
];

export function V3Accessibility() {
  return (
    <div className="min-h-screen bg-background p-6 font-sans">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Occupancy UrbnSurf Melbourne</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monitor real-time session capacity.</p>
        </div>
        <button className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-sm font-medium bg-card shadow-sm">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          4 June 2026
        </button>
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Session Occupancy
        </h2>
        <button className="text-xs text-muted-foreground border border-border rounded px-2.5 py-1.5 hover:bg-muted transition-colors">View Raw List</button>
      </div>

      {/* Column headers — explicit "LEFT WAVE" / "RIGHT WAVE" text, not just dot+label */}
      <div className="grid grid-cols-[1fr_180px_1fr] text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-3">
        <div>← Left Wave</div>
        <div className="text-center">Time &amp; Session</div>
        <div className="text-right">Right Wave →</div>
      </div>

      {/* Rows */}
      <div className="rounded-xl border border-border shadow-sm overflow-hidden bg-card divide-y divide-border">
        {HOURS.map(({ time, title, fill, left, right }) => {
          const color = SESSION_COLORS[title] ?? "hsl(var(--primary))";
          const leftPct = (left.booked / left.total) * 100;
          const rightPct = (right.booked / right.total) * 100;

          // High-contrast fill badge: text is always foreground-on-background, no color-only
          const fillBg = fill > 85 ? "bg-red-100 text-red-800 border border-red-300" : fill > 60 ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-sky-100 text-sky-800 border border-sky-300";
          const fillLabel = fill > 85 ? "HIGH" : fill > 60 ? "MED" : "LOW";

          return (
            <div
              key={time}
              className="grid grid-cols-[1fr_180px_1fr] items-stretch hover:bg-muted/20 transition-colors"
            >
              {/* LEFT — "L" prefix removes color-only differentiation */}
              <div className="flex flex-col justify-center gap-1.5 px-3 py-3.5 pr-2">
                <div className="flex items-baseline gap-1">
                  {/* Explicit "L" label — not just color */}
                  <span className="text-[10px] font-bold text-muted-foreground mr-0.5">L</span>
                  <span className="text-2xl font-bold text-foreground leading-none">{left.booked}</span>
                  <span className="text-xs text-muted-foreground">/ {left.total} booked</span>
                </div>
                {/* Bar with larger height for easier scanning */}
                <div className="flex justify-end h-[20px]">
                  <div className="h-full rounded-l-full relative overflow-hidden" style={{ width: `${leftPct}%`, backgroundColor: color }}>
                    {leftPct > 25 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/80">
                        {Math.round(leftPct)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* CENTRE — larger minimum font size, fill info is clear */}
              <div className="flex flex-col items-center justify-center text-center py-3.5 border-x border-border/50 gap-1">
                <span className="font-bold text-base leading-none">{time}</span>
                <span className="text-xs text-muted-foreground leading-tight">{title}</span>
                {/* Badge includes both % and a text level — two signals, not one */}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${fillBg}`}>
                  {fill}% · {fillLabel}
                </span>
              </div>

              {/* RIGHT — "R" prefix */}
              <div className="flex flex-col justify-center gap-1.5 px-3 py-3.5 pl-2">
                <div className="flex items-baseline justify-end gap-1">
                  <span className="text-xs text-muted-foreground">{right.total} booked /</span>
                  <span className="text-2xl font-bold text-foreground leading-none">{right.booked}</span>
                  <span className="text-[10px] font-bold text-muted-foreground ml-0.5">R</span>
                </div>
                <div className="flex justify-start h-[20px]">
                  <div className="h-full rounded-r-full relative overflow-hidden" style={{ width: `${rightPct}%`, backgroundColor: color }}>
                    {rightPct > 25 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/80">
                        {Math.round(rightPct)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground text-center italic">
        Variation 3 — L/R labels, % inside bars, text-level badges. No color-only signals.
      </p>
    </div>
  );
}
