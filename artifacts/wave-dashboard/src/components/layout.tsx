import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Waves, LayoutDashboard, Server, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import {
  useHealthCheck,
  getHealthCheckQueryKey,
  useRefreshSessions,
  useGetLastRefresh,
  getGetLastRefreshQueryKey,
} from "@workspace/api-client-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useQueryClient } from "@tanstack/react-query";

const COOLDOWN_MS = 3 * 60 * 1000;

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck({ query: { retry: false, refetchInterval: 30000, queryKey: getHealthCheckQueryKey() } });
  const queryClient = useQueryClient();

  // Poll last-refresh every 30s so other users' refreshes propagate to everyone's UI
  const { data: lastRefresh } = useGetLastRefresh({
    query: { queryKey: getGetLastRefreshQueryKey(), retry: false, refetchInterval: 30000 },
  });

  // Tick every second while cooling down to update the countdown display
  const [, setTick] = useState(0);
  const serverRefreshTime = lastRefresh?.refreshed_at ? new Date(lastRefresh.refreshed_at).getTime() : null;
  const elapsed = serverRefreshTime !== null ? Date.now() - serverRefreshTime : COOLDOWN_MS;
  const isCoolingDown = elapsed < COOLDOWN_MS;
  const secondsLeft = isCoolingDown ? Math.ceil((COOLDOWN_MS - elapsed) / 1000) : 0;

  useEffect(() => {
    if (!isCoolingDown) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isCoolingDown]);

  const refreshMutation = useRefreshSessions({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries();
      },
      onError: () => {
        // 429s are silently handled by the dimmed UI; only surface genuine failures
        queryClient.invalidateQueries({ queryKey: getGetLastRefreshQueryKey() });
      },
    },
  });

  const tooltipText = refreshMutation.isPending
    ? "Fetching live data…"
    : isCoolingDown
      ? `Next refresh available in ${secondsLeft}s`
      : "Pull today & tomorrow from UrbnSurf";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="sticky top-0 z-30 w-full border-b bg-primary text-primary-foreground shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-accent text-accent-foreground flex items-center justify-center shadow-inner">
                <Waves className="w-5 h-5" />
              </div>
              <div className="font-heading font-bold text-lg tracking-wide hidden sm:block">
                WAVEPARK OPS
              </div>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary-foreground/10 text-xs font-medium">
                  <div className={`w-2 h-2 rounded-full ${health?.status === 'ok' ? 'bg-emerald-400' : 'bg-destructive animate-pulse'}`} />
                  <Server className="w-3 h-3 hidden sm:block" />
                  <span className="hidden sm:inline">{health?.status === 'ok' ? 'System Online' : 'Connecting...'}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>API Status: {health?.status || 'Unknown'}</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href="/" className="block">
              <Button
                variant={location === "/" ? "secondary" : "ghost"}
                className={`h-9 px-3 sm:px-4 font-medium transition-colors ${
                  location === "/"
                    ? "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                    : "text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                }`}
              >
                <LayoutDashboard className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className={`h-9 px-3 sm:px-4 font-medium transition-all duration-300 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground ${isCoolingDown ? "opacity-35 cursor-not-allowed" : ""}`}
                  onClick={() => { if (!isCoolingDown) refreshMutation.mutate(); }}
                  disabled={refreshMutation.isPending}
                >
                  <RefreshCw className={`w-4 h-4 sm:mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{tooltipText}</p>
              </TooltipContent>
            </Tooltip>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {children}
      </main>
    </div>
  );
}
