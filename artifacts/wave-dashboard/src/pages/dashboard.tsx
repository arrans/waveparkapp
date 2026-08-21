import { useState, useMemo } from "react";
import { Link } from "wouter";
import { 
  useListDates, 
  useGetSessionsByHour,
  useListSessions,
  useGetLastRefresh,
  getListDatesQueryKey,
  getGetSessionsByHourQueryKey,
  getListSessionsQueryKey,
  getGetLastRefreshQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, AlertCircle, ListFilter, ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const SESSION_COLORS: Record<string, string> = {
  "Roller":                "rgb(51, 117, 125)",
  "Cruiser":               "rgb(70, 190, 176)",
  "Progressive Turns":     "rgb(51, 117, 125)",
  "Intermediate":          "rgb(69, 124, 175)",
  "Intermediate Plus":     "rgb(62, 60, 60)",
  "Intermediate Barrels":  "rgb(155, 223, 234)",
  "Advanced Turns":        "rgb(210, 175, 255)",
  "Pro Turns":             "rgb(255, 150, 145)",
  "Advanced":              "rgb(246, 180, 64)",
  "Expert":                "rgb(255, 150, 145)",
  "Boogie Nights":         "rgb(60, 176, 67)",
};

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRawList, setShowRawList] = useState(false);

  // Last-refresh timestamp (404 = never refreshed → undefined)
  const { data: lastRefresh } = useGetLastRefresh({
    query: { queryKey: getGetLastRefreshQueryKey(), retry: false }
  });

  // 1. Fetch available dates
  const { data: dates, isLoading: loadingDates, isError: datesError } = useListDates({
    query: {
      queryKey: getListDatesQueryKey()
    }
  });

  // Set default date when dates load — prefer today, fall back to most recent past date
  useMemo(() => {
    if (dates && dates.length > 0 && !selectedDate) {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" });
      if (dates.includes(today)) {
        setSelectedDate(today);
      } else {
        // Pick the most recent date that is before today
        const sorted = [...dates].sort((a, b) => b.localeCompare(a));
        const mostRecent = sorted.find(d => d < today) ?? sorted[sorted.length - 1];
        setSelectedDate(mostRecent);
      }
    }
  }, [dates, selectedDate]);

  // 2. Fetch hourly data for selected date
  const { data: hourlyData, isLoading: loadingHourly } = useGetSessionsByHour(
    { date: selectedDate! },
    { 
      query: { 
        enabled: !!selectedDate,
        queryKey: getGetSessionsByHourQueryKey({ date: selectedDate! })
      } 
    }
  );

  // 4. Fetch raw sessions list (satisfies useListSessions requirement)
  const { data: allSessions, isLoading: loadingAll } = useListSessions(
    { date: selectedDate! },
    {
      query: {
        enabled: !!selectedDate && showRawList,
        queryKey: getListSessionsQueryKey({ date: selectedDate! })
      }
    }
  );


  // Calendar popover state — default to current month
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const datesSet = useMemo(() => new Set(dates ?? []), [dates]);

  if (datesError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-2xl font-bold font-heading">Unable to load data</h2>
        <p className="text-muted-foreground max-w-md">There was a problem connecting to the wave park servers. Please try again later.</p>
        <Button onClick={() => window.location.reload()}>Retry Connection</Button>
      </div>
    );
  }

  if (loadingDates && !dates) {
    return <DashboardSkeleton />;
  }

  if (dates && dates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 bg-card rounded-xl border shadow-sm">
        <Clock className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-2xl font-bold font-heading">No Session Data</h2>
        <p className="text-muted-foreground max-w-md mb-4">Use the Refresh button in the nav to pull live session data from UrbnSurf.</p>
      </div>
    );
  }

  const isLoadingData = loadingHourly;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-foreground">Occupancy UrbnSurf Melbourne</h1>
          <p className="text-muted-foreground">Monitor real-time session capacity.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full sm:w-[200px] justify-start gap-2 bg-card font-medium"
                disabled={!dates || dates.length === 0}
                data-testid="button-date-picker"
              >
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                {selectedDate
                  ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", weekday: "long" })
                  : "Select Date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <DatePickerCalendar
                year={calendarMonth.year}
                month={calendarMonth.month}
                selectedDate={selectedDate}
                datesWithData={datesSet}
                onSelectDate={(d) => { setSelectedDate(d); setCalendarOpen(false); }}
                onChangeMonth={(year, month) => setCalendarMonth({ year, month })}
              />
            </PopoverContent>
          </Popover>
          
        </div>
      </div>

      {isLoadingData ? (
        <ContentSkeleton />
      ) : (
        <>
          {/* Hourly Breakdowns */}
          <div>
            <div className="flex items-center justify-between mb-4 mt-8">
              <div className="flex items-baseline gap-3 flex-wrap">
                <h2 className="text-xl font-bold font-heading flex items-center gap-2">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  Session Occupancy
                </h2>
                {lastRefresh && (
                  <span className="text-xs text-muted-foreground font-normal">
                    Last updated {new Date(lastRefresh.refreshed_at).toLocaleString("en-AU", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit"
                    })}
                  </span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowRawList(!showRawList)}>
                <ListFilter className="w-4 h-4 mr-2" />
                {showRawList ? 'Hide Raw List' : 'View Raw List'}
              </Button>
            </div>

            {showRawList && (
              <Card className="mb-6 shadow-sm border-border">
                <CardHeader className="bg-muted/30 pb-4 border-b">
                  <CardTitle className="text-base">Raw Session Data</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingAll ? (
                    <div className="p-4 text-center text-muted-foreground">Loading...</div>
                  ) : (
                    <div className="max-h-[300px] overflow-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 sticky top-0 text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2 font-medium">Time</th>
                            <th className="px-4 py-2 font-medium">Title</th>
                            <th className="px-4 py-2 font-medium">Dir</th>
                            <th className="px-4 py-2 font-medium text-right">Booked</th>
                            <th className="px-4 py-2 font-medium text-right">Avail</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {allSessions?.map(s => (
                            <tr key={s.id} className="hover:bg-muted/30">
                              <td className="px-4 py-2">{s.time}</td>
                              <td className="px-4 py-2">{s.title}</td>
                              <td className="px-4 py-2 capitalize">{s.wave_direction}</td>
                              <td className="px-4 py-2 text-right">{s.capacity_booked}</td>
                              <td className="px-4 py-2 text-right text-muted-foreground">{s.capacity_available}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Column headers */}
            <div className="grid grid-cols-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-4">
              <div className="text-left flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                Left
              </div>
              <div className="text-center">Time &amp; Setting</div>
              <div className="text-right flex items-center justify-end gap-1.5">
                Right
                <div className="w-2 h-2 rounded-full bg-accent" />
              </div>
            </div>

            <Card className="shadow-sm overflow-hidden divide-y divide-border">
              {hourlyData?.map((hour) => {
                const leftSession = hour.sessions.find(s => s.wave_direction === 'left');
                const rightSession = hour.sessions.find(s => s.wave_direction === 'right');
                const title = leftSession?.title ?? rightSession?.title ?? "";
                const fillRate = Math.round(hour.occupancy_rate * 100);
                const barColor = SESSION_COLORS[title] ?? "hsl(var(--primary))";

                const leftTotal = leftSession ? leftSession.capacity_booked + leftSession.capacity_available : 0;
                const rightTotal = rightSession ? rightSession.capacity_booked + rightSession.capacity_available : 0;
                const leftPct = leftTotal > 0 ? (leftSession!.capacity_booked / leftTotal) * 100 : 0;
                const rightPct = rightTotal > 0 ? (rightSession!.capacity_booked / rightTotal) * 100 : 0;

                // Fade past sessions when viewing today
                const today = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" });
                const isToday = selectedDate === today;
                const sessionHour = parseInt(hour.time.split(":")[0], 10);
                const currentHour = parseInt(new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", hour: "2-digit", hour12: false }).format(new Date()), 10) % 24;
                const isPast = isToday && currentHour > sessionHour;

                return (
                  <div
                    key={hour.time}
                    data-testid={`row-hour-${hour.time}`}
                    className={`grid grid-cols-3 items-stretch hover:bg-muted/30 transition-all duration-300 ${isPast ? "opacity-40" : ""}`}
                  >
                    {/* Left column: number + bar growing from right (centre) to left */}
                    <div className="flex flex-col justify-center gap-1 px-4 py-3 pr-2">
                      {leftSession ? (
                        <>
                          <div className="flex items-baseline gap-1">
                            <span
                              data-testid={`text-left-booked-${hour.time}`}
                              className="text-2xl font-bold font-heading text-primary leading-none"
                            >
                              {leftSession.capacity_booked}
                            </span>
                            <span className="text-xs text-muted-foreground">/ {leftTotal}</span>
                          </div>
                          {/* Bar anchored to the right edge (centre), expands leftward */}
                          <div className="flex justify-end h-[18px]">
                            <div
                              className="h-full rounded-l-full transition-all duration-500"
                              style={{ width: `${leftPct}%`, backgroundColor: barColor }}
                            />
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>

                    {/* Centre: time + title + fill badge */}
                    <div className="flex flex-col items-center justify-center gap-0.5 text-center py-3 border-x border-border/50">
                      <span className="font-bold font-heading text-base leading-none">{hour.time}</span>
                      <span className="text-xs text-muted-foreground leading-tight">{title}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${
                        fillRate > 85
                          ? 'bg-destructive/10 text-destructive'
                          : fillRate > 60
                          ? 'bg-accent/15 text-accent-foreground'
                          : 'bg-primary/10 text-primary'
                      }`}>
                        {fillRate}%
                      </span>
                    </div>

                    {/* Right column: bar growing from left (centre) to right + number */}
                    <div className="flex flex-col justify-center gap-1 px-4 py-3 pl-2">
                      {rightSession ? (
                        <>
                          <div className="flex items-baseline justify-end gap-1">
                            <span className="text-xs text-muted-foreground">/ {rightTotal}</span>
                            <span
                              data-testid={`text-right-booked-${hour.time}`}
                              className="text-2xl font-bold font-heading text-accent leading-none"
                            >
                              {rightSession.capacity_booked}
                            </span>
                          </div>
                          {/* Bar anchored to the left edge (centre), expands rightward */}
                          <div className="flex justify-start h-[18px]">
                            <div
                              className="h-full rounded-r-full transition-all duration-500"
                              style={{ width: `${rightPct}%`, backgroundColor: barColor }}
                            />
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-sm text-right">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}


function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-[200px]" />
      </div>
      <ContentSkeleton />
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-[400px] rounded-xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
      </div>
    </div>
  );
}


const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function DatePickerCalendar({
  year, month, selectedDate, datesWithData, onSelectDate, onChangeMonth
}: {
  year: number;
  month: number;
  selectedDate: string | null;
  datesWithData: Set<string>;
  onSelectDate: (date: string) => void;
  onChangeMonth: (year: number, month: number) => void;
}) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" });

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first: Sun(0)→6, Mon(1)→0, Tue(2)→1, etc.
  const leadingEmpties = (firstDay.getDay() + 6) % 7;

  const prevMonth = () => {
    if (month === 0) onChangeMonth(year - 1, 11);
    else onChangeMonth(year, month - 1);
  };
  const nextMonth = () => {
    if (month === 11) onChangeMonth(year + 1, 0);
    else onChangeMonth(year, month + 1);
  };

  const cells: (number | null)[] = [
    ...Array(leadingEmpties).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="p-3 select-none w-[280px]">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-muted transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold">{MONTH_NAMES[month]} {year}</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-muted transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} />;

          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const hasData = datesWithData.has(dateStr);
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today;

          return (
            <button
              key={dateStr}
              data-testid={`date-${dateStr}`}
              onClick={() => hasData && onSelectDate(dateStr)}
              className={[
                "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : hasData
                  ? "hover:bg-muted cursor-pointer text-foreground"
                  : "text-muted-foreground/40 cursor-default",
                !isSelected && isToday ? "ring-1 ring-primary/50 ring-offset-1" : "",
              ].join(" ")}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
