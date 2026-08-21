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

export function V2Affordances() {
  return (
    <div className="min-h-screen bg-background p-6 font-sans">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Occupancy UrbnSurf Melbourne</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monitor real-time session capacity.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date picker: explicit dropdown affordance, clear pressed state */}
          <button className="flex items-center gap-2 border-2 border-primary/30 bg-primary/5 rounded-lg px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:border-primary/60 transition-colors group">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            4 June 2026
            <svg className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {/* + button with visible label on desktop */}
          <button className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-2.5 text-sm font-semibold shadow-sm hover:bg-primary/90 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add
          </button>
        </div>
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Session Occupancy
        </h2>
        {/* Toggle chip — active/off state is visually explicit */}
        <button className="flex items-center gap-1.5 text-xs font-medium border border-border rounded-full px-3 py-1.5 hover:bg-muted transition-colors text-muted-foreground">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          Raw List
        </button>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_160px_1fr] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-3">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary inline-block"/>Left</div>
        <div className="text-center">Time &amp; Setting</div>
        <div className="flex items-center justify-end gap-1.5">Right<span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/></div>
      </div>

      {/* Rows — each row reads as a distinct, hoverable item */}
      <div className="rounded-xl border border-border shadow-sm overflow-hidden bg-card divide-y divide-border">
        {HOURS.map(({ time, title, fill, left, right }) => {
          const color = SESSION_COLORS[title] ?? "hsl(var(--primary))";
          const leftPct = (left.booked / left.total) * 100;
          const rightPct = (right.booked / right.total) * 100;
          const fillColor = fill > 85 ? "text-red-600 bg-red-50" : fill > 60 ? "text-amber-700 bg-amber-50" : "text-sky-700 bg-sky-50";

          return (
            <div
              key={time}
              className="grid grid-cols-[1fr_160px_1fr] items-stretch cursor-pointer hover:bg-muted/40 active:bg-muted/60 transition-colors group"
            >
              {/* LEFT */}
              <div className="flex flex-col justify-center gap-1 px-3 py-3 pr-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-primary leading-none">{left.booked}</span>
                  <span className="text-[11px] text-muted-foreground">/ {left.total}</span>
                </div>
                <div className="flex justify-end h-[18px]">
                  <div className="h-full rounded-l-full" style={{ width: `${leftPct}%`, backgroundColor: color }} />
                </div>
              </div>

              {/* CENTRE */}
              <div className="flex flex-col items-center justify-center text-center py-3 border-x border-border/50 gap-0.5">
                <span className="font-bold text-base leading-none">{time}</span>
                <span className="text-xs text-muted-foreground leading-tight">{title}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${fillColor}`}>{fill}%</span>
              </div>

              {/* RIGHT + chevron affordance on hover */}
              <div className="flex flex-col justify-center gap-1 px-3 py-3 pl-2 relative">
                <div className="flex items-baseline justify-end gap-1">
                  <span className="text-[11px] text-muted-foreground">/ {right.total}</span>
                  <span className="text-2xl font-bold text-orange-500 leading-none">{right.booked}</span>
                </div>
                <div className="flex justify-start h-[18px]">
                  <div className="h-full rounded-r-full" style={{ width: `${rightPct}%`, backgroundColor: color }} />
                </div>
                {/* Subtle expand hint on hover */}
                <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground text-center italic">
        Variation 2 — Controls are explicitly interactive. Date picker has chevron affordance. Rows feel clickable.
      </p>
    </div>
  );
}
