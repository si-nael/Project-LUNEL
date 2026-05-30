"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
    History,
    Clock,
    Rewind,
    RotateCcw,
    ArrowLeftRight,
    Loader2,
    ChevronDown,
    AlertTriangle,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/* ── Types ─────────────────────────────────────────────────── */

interface HistoryEntry {
    id: string;
    changed_by: string;
    change_type: string;
    previous_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
    changed_at: string;
    schedule_id?: string;
    project_id?: string;
}

interface Schedule {
    id: string;
    title: string;
}

interface Project {
    id: string;
    title: string;
}

type EntityState = Record<string, unknown>;

/* ── Helpers ───────────────────────────────────────────────── */

const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });

const formatShortDate = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

const CHANGE_TYPE_CONFIG: Record<
    string,
    { color: string; dotColor: string; label: string }
> = {
    CREATE: {
        color: "bg-emerald-500/10 text-emerald-500",
        dotColor: "bg-emerald-500",
        label: "생성",
    },
    UPDATE: {
        color: "bg-amber-500/10 text-amber-500",
        dotColor: "bg-amber-500",
        label: "수정",
    },
    DELETE: {
        color: "bg-destructive/10 text-destructive",
        dotColor: "bg-destructive",
        label: "삭제",
    },
};

/** Compare two values for diff highlighting */
function diffKeys(
    past: EntityState | null,
    current: EntityState | null
): Set<string> {
    const changed = new Set<string>();
    if (!past || !current) return changed;
    const allKeys = new Set([...Object.keys(past), ...Object.keys(current)]);
    for (const key of allKeys) {
        if (JSON.stringify(past[key]) !== JSON.stringify(current[key])) {
            changed.add(key);
        }
    }
    return changed;
}

/* ── Main Component ────────────────────────────────────────── */

export default function HistoryPage() {
    const { user } = useAuth();

    // Entity selection
    const [mode, setMode] = useState<"schedule" | "project">("schedule");
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedId, setSelectedId] = useState("");

    // History data
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(false);

    // Time travel state
    const [sliderValue, setSliderValue] = useState(100);
    const [timeTravelState, setTimeTravelState] = useState<EntityState | null>(
        null
    );
    const [currentState, setCurrentState] = useState<EntityState | null>(null);
    const [timeTravelLoading, setTimeTravelLoading] = useState(false);
    const [timeTravelTimestamp, setTimeTravelTimestamp] = useState<string | null>(
        null
    );
    const [showComparison, setShowComparison] = useState(false);

    // Restore confirmation dialog
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [restoring, setRestoring] = useState(false);

    // Timeline scroll ref
    const timelineRef = useRef<HTMLDivElement>(null);

    // Debounce ref for slider
    const sliderDebounceRef = useRef<NodeJS.Timeout | null>(null);

    /* ── Data loading ───────────────────────────────────────── */

    useEffect(() => {
        api.get("/schedules")
            .then((res) => setSchedules(res.data))
            .catch(() => {});
        api.get("/projects")
            .then((res) => setProjects(res.data))
            .catch(() => {});
    }, []);

    const loadHistory = async (id: string) => {
        setLoading(true);
        setTimeTravelState(null);
        setCurrentState(null);
        setShowComparison(false);
        setSliderValue(100);
        try {
            const endpoint =
                mode === "schedule"
                    ? `/schedules/${id}/history`
                    : `/projects/${id}/history`;
            const res = await api.get(endpoint);
            setHistory(res.data);

            // Fetch current state
            const currentEndpoint =
                mode === "schedule" ? `/schedules/${id}` : `/projects/${id}`;
            const currentRes = await api.get(currentEndpoint);
            setCurrentState(currentRes.data);
        } catch {
            setHistory([]);
            setCurrentState(null);
        }
        setLoading(false);
    };

    const handleSelect = (id: string) => {
        setSelectedId(id);
        if (id) loadHistory(id);
        else {
            setHistory([]);
            setCurrentState(null);
            setTimeTravelState(null);
            setShowComparison(false);
        }
    };

    /* ── Time travel range ──────────────────────────────────── */

    const timeRange = useMemo(() => {
        if (history.length === 0) return null;
        const sorted = [...history].sort(
            (a, b) =>
                new Date(a.changed_at).getTime() -
                new Date(b.changed_at).getTime()
        );
        const start = new Date(sorted[0].changed_at).getTime();
        const end = Date.now();
        return { start, end };
    }, [history]);

    const sliderToTimestamp = useCallback(
        (value: number): string => {
            if (!timeRange) return new Date().toISOString();
            const ts =
                timeRange.start +
                (value / 100) * (timeRange.end - timeRange.start);
            return new Date(ts).toISOString();
        },
        [timeRange]
    );

    /* ── Fetch time-travel snapshot ─────────────────────────── */

    const fetchTimeTravelState = useCallback(
        async (timestamp: string) => {
            if (!selectedId) return;
            setTimeTravelLoading(true);
            try {
                const endpoint =
                    mode === "schedule"
                        ? `/schedules/${selectedId}/at`
                        : `/projects/${selectedId}/at`;
                const res = await api.get(endpoint, {
                    params: { timestamp },
                });
                setTimeTravelState(res.data);
                setTimeTravelTimestamp(timestamp);
                setShowComparison(true);
            } catch {
                toast.error("해당 시점의 상태를 불러올 수 없습니다.");
                setTimeTravelState(null);
                setShowComparison(false);
            }
            setTimeTravelLoading(false);
        },
        [selectedId, mode]
    );

    const handleSliderChange = useCallback(
        (value: number) => {
            setSliderValue(value);
            if (sliderDebounceRef.current) {
                clearTimeout(sliderDebounceRef.current);
            }
            sliderDebounceRef.current = setTimeout(() => {
                const ts = sliderToTimestamp(value);
                fetchTimeTravelState(ts);
            }, 300);
        },
        [sliderToTimestamp, fetchTimeTravelState]
    );

    /* ── Restore logic ──────────────────────────────────────── */

    const handleRestore = async () => {
        if (!timeTravelState || !selectedId) return;
        setRestoring(true);
        try {
            const endpoint =
                mode === "schedule"
                    ? `/schedules/${selectedId}`
                    : `/projects/${selectedId}`;
            await api.patch(endpoint, timeTravelState);
            toast.success("이전 상태로 복원되었습니다.");
            setRestoreDialogOpen(false);
            // Reload
            loadHistory(selectedId);
        } catch {
            toast.error("복원에 실패했습니다.");
        }
        setRestoring(false);
    };

    /* ── Diff computation ───────────────────────────────────── */

    const changedKeys = useMemo(
        () => diffKeys(timeTravelState, currentState),
        [timeTravelState, currentState]
    );

    /* ── Timeline dot position from history entry ───────────── */

    const getTimelinePosition = useCallback(
        (changedAt: string) => {
            if (!timeRange) return 0;
            const ts = new Date(changedAt).getTime();
            return (
                ((ts - timeRange.start) / (timeRange.end - timeRange.start)) *
                100
            );
        },
        [timeRange]
    );

    /* ── Sorted history (oldest first for timeline) ─────────── */

    const sortedHistory = useMemo(
        () =>
            [...history].sort(
                (a, b) =>
                    new Date(a.changed_at).getTime() -
                    new Date(b.changed_at).getTime()
            ),
        [history]
    );

    const items = mode === "schedule" ? schedules : projects;

    /* ── Render ──────────────────────────────────────────────── */

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <History className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">
                        변경 이력
                    </h1>
                    <p className="text-xs text-muted-foreground">
                        타임 트래블로 과거 상태를 확인하고 복원하세요
                    </p>
                </div>
            </div>

            {/* Controls: Mode + Entity selection */}
            <div className="flex gap-4 mb-6">
                <div className="flex rounded-xl overflow-hidden border border-border/60">
                    <button
                        onClick={() => {
                            setMode("schedule");
                            setSelectedId("");
                            setHistory([]);
                            setTimeTravelState(null);
                            setCurrentState(null);
                            setShowComparison(false);
                        }}
                        className={cn(
                            "px-4 py-1.5 text-xs transition-all",
                            mode === "schedule"
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground/60 hover:text-foreground"
                        )}
                    >
                        일정
                    </button>
                    <button
                        onClick={() => {
                            setMode("project");
                            setSelectedId("");
                            setHistory([]);
                            setTimeTravelState(null);
                            setCurrentState(null);
                            setShowComparison(false);
                        }}
                        className={cn(
                            "px-4 py-1.5 text-xs transition-all",
                            mode === "project"
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground/60 hover:text-foreground"
                        )}
                    >
                        프로젝트
                    </button>
                </div>

                <div className="relative flex-1">
                    <select
                        value={selectedId}
                        onChange={(e) => handleSelect(e.target.value)}
                        className="w-full border border-border/60 bg-transparent rounded-xl px-4 py-1.5 text-xs appearance-none focus:outline-none focus:ring-1 focus:ring-ring/40 pr-8"
                    >
                        <option value="">
                            {mode === "schedule" ? "일정" : "프로젝트"} 선택...
                        </option>
                        {items.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.title}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex justify-center py-10">
                    <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
            )}

            {/* No history */}
            {selectedId && !loading && history.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-10">
                    변경 이력이 없습니다.
                </p>
            )}

            {/* Main content: timeline + time travel */}
            {history.length > 0 && !loading && (
                <div className="space-y-6">
                    {/* ── Time Travel Slider ─────────────────────── */}
                    <div className="glass rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Rewind className="h-4 w-4 text-primary" />
                            <h2 className="text-sm font-semibold">
                                타임 트래블
                            </h2>
                            {timeTravelLoading && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />
                            )}
                        </div>

                        {/* Slider */}
                        <div className="relative mb-2">
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={0.1}
                                value={sliderValue}
                                onChange={(e) =>
                                    handleSliderChange(
                                        parseFloat(e.target.value)
                                    )
                                }
                                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-foreground/[0.06] accent-primary
                                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-primary/25 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
                                    [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background
                                    [&::-webkit-slider-runnable-track]:rounded-full [&::-moz-range-track]:rounded-full"
                            />
                        </div>

                        {/* Time labels */}
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {timeRange &&
                                    formatShortDate(
                                        new Date(
                                            timeRange.start
                                        ).toISOString()
                                    )}
                            </span>
                            {timeTravelTimestamp && sliderValue < 100 && (
                                <span className="text-primary font-medium">
                                    {formatDate(timeTravelTimestamp)}
                                </span>
                            )}
                            <span>현재</span>
                        </div>

                        {/* Timeline dots overlay */}
                        <div className="relative h-3 mt-3 mb-1">
                            {sortedHistory.map((entry) => {
                                const pos = getTimelinePosition(
                                    entry.changed_at
                                );
                                const config =
                                    CHANGE_TYPE_CONFIG[entry.change_type];
                                return (
                                    <div
                                        key={entry.id}
                                        className="absolute top-1/2 -translate-y-1/2 group"
                                        style={{ left: `${pos}%` }}
                                    >
                                        <div
                                            className={cn(
                                                "h-2.5 w-2.5 rounded-full -translate-x-1/2 ring-2 ring-background transition-transform hover:scale-150 cursor-pointer",
                                                config?.dotColor ||
                                                    "bg-foreground/30"
                                            )}
                                            onClick={() => {
                                                const pct = pos;
                                                setSliderValue(pct);
                                                fetchTimeTravelState(
                                                    entry.changed_at
                                                );
                                            }}
                                        />
                                        {/* Tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                            <div className="glass-subtle rounded-lg px-3 py-2 text-[11px] whitespace-nowrap shadow-lg border border-border/40">
                                                <div className="font-medium">
                                                    {config?.label ||
                                                        entry.change_type}
                                                </div>
                                                <div className="text-muted-foreground">
                                                    {formatDate(
                                                        entry.changed_at
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {/* Slider position indicator */}
                            <div
                                className="absolute top-1/2 -translate-y-1/2 h-5 w-0.5 bg-primary/40 rounded-full -translate-x-1/2 pointer-events-none transition-[left] duration-100"
                                style={{ left: `${sliderValue}%` }}
                            />
                        </div>
                    </div>

                    {/* ── Side-by-Side Comparison ────────────────── */}
                    <div
                        className={cn(
                            "transition-all duration-500 ease-out overflow-hidden",
                            showComparison && timeTravelState
                                ? "max-h-[2000px] opacity-100 translate-y-0"
                                : "max-h-0 opacity-0 -translate-y-4"
                        )}
                    >
                        <div className="glass rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <ArrowLeftRight className="h-4 w-4 text-primary" />
                                    <h2 className="text-sm font-semibold">
                                        상태 비교
                                    </h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs gap-1.5"
                                        onClick={() =>
                                            setRestoreDialogOpen(true)
                                        }
                                        disabled={
                                            !timeTravelState ||
                                            sliderValue >= 100
                                        }
                                    >
                                        <RotateCcw className="h-3 w-3" />
                                        이 시점으로 복원
                                    </Button>
                                </div>
                            </div>

                            {/* Column headers */}
                            <div className="grid grid-cols-2 gap-4 mb-3">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <Rewind className="h-3 w-3" />
                                    과거 상태
                                    {timeTravelTimestamp && (
                                        <span className="text-[10px] text-muted-foreground/70">
                                            (
                                            {formatShortDate(
                                                timeTravelTimestamp
                                            )}
                                            )
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    현재 상태
                                </div>
                            </div>

                            {/* Diff view */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Past state */}
                                <div className="glass-subtle rounded-xl p-3 space-y-1.5 max-h-96 overflow-auto">
                                    {timeTravelState &&
                                        Object.entries(timeTravelState).map(
                                            ([key, value]) => {
                                                const isChanged =
                                                    changedKeys.has(key);
                                                const isRemoved =
                                                    currentState &&
                                                    !(key in currentState);
                                                return (
                                                    <div
                                                        key={key}
                                                        className={cn(
                                                            "flex items-start gap-2 px-2 py-1 rounded-lg text-[11px] transition-colors",
                                                            isRemoved
                                                                ? "bg-destructive/10 border border-destructive/20"
                                                                : isChanged
                                                                  ? "bg-amber-500/10 border border-amber-500/20"
                                                                  : "hover:bg-foreground/[0.02]"
                                                        )}
                                                    >
                                                        <span className="font-mono text-muted-foreground shrink-0 min-w-[120px]">
                                                            {key}
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                "break-all",
                                                                isChanged
                                                                    ? "text-amber-600 dark:text-amber-400"
                                                                    : "text-foreground/70"
                                                            )}
                                                        >
                                                            {typeof value ===
                                                            "object"
                                                                ? JSON.stringify(
                                                                      value
                                                                  )
                                                                : String(
                                                                      value ??
                                                                          "null"
                                                                  )}
                                                        </span>
                                                    </div>
                                                );
                                            }
                                        )}
                                </div>

                                {/* Current state */}
                                <div className="glass-subtle rounded-xl p-3 space-y-1.5 max-h-96 overflow-auto">
                                    {currentState &&
                                        Object.entries(currentState).map(
                                            ([key, value]) => {
                                                const isChanged =
                                                    changedKeys.has(key);
                                                const isAdded =
                                                    timeTravelState &&
                                                    !(key in timeTravelState);
                                                return (
                                                    <div
                                                        key={key}
                                                        className={cn(
                                                            "flex items-start gap-2 px-2 py-1 rounded-lg text-[11px] transition-colors",
                                                            isAdded
                                                                ? "bg-emerald-500/10 border border-emerald-500/20"
                                                                : isChanged
                                                                  ? "bg-amber-500/10 border border-amber-500/20"
                                                                  : "hover:bg-foreground/[0.02]"
                                                        )}
                                                    >
                                                        <span className="font-mono text-muted-foreground shrink-0 min-w-[120px]">
                                                            {key}
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                "break-all",
                                                                isChanged
                                                                    ? "text-amber-600 dark:text-amber-400"
                                                                    : "text-foreground/70"
                                                            )}
                                                        >
                                                            {typeof value ===
                                                            "object"
                                                                ? JSON.stringify(
                                                                      value
                                                                  )
                                                                : String(
                                                                      value ??
                                                                          "null"
                                                                  )}
                                                        </span>
                                                    </div>
                                                );
                                            }
                                        )}
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40">
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <div className="h-2.5 w-2.5 rounded-sm bg-amber-500/20 border border-amber-500/30" />
                                    변경됨
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/30" />
                                    추가됨
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <div className="h-2.5 w-2.5 rounded-sm bg-destructive/20 border border-destructive/30" />
                                    제거됨
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Visual Timeline ────────────────────────── */}
                    <div
                        ref={timelineRef}
                        className="glass rounded-2xl p-5"
                    >
                        <div className="flex items-center gap-2 mb-5">
                            <Clock className="h-4 w-4 text-primary" />
                            <h2 className="text-sm font-semibold">
                                변경 타임라인
                            </h2>
                            <span className="text-[11px] text-muted-foreground ml-auto">
                                {history.length}건의 변경사항
                            </span>
                        </div>

                        <div className="relative pl-6">
                            {/* Vertical line */}
                            <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-border/60 rounded-full" />

                            {/* Slider position indicator on timeline */}
                            {sliderValue < 100 && timeRange && (
                                <div
                                    className="absolute left-0 w-5 h-0.5 bg-primary rounded-full transition-[top] duration-200 z-10"
                                    style={{
                                        top: `${sliderValue}%`,
                                    }}
                                />
                            )}

                            <div className="space-y-0">
                                {sortedHistory.map((entry, i) => {
                                    const config =
                                        CHANGE_TYPE_CONFIG[entry.change_type];
                                    const isActive =
                                        timeTravelTimestamp &&
                                        new Date(
                                            entry.changed_at
                                        ).getTime() <=
                                            new Date(
                                                timeTravelTimestamp
                                            ).getTime() +
                                                1000;

                                    return (
                                        <div
                                            key={entry.id}
                                            className={cn(
                                                "relative pl-6 pb-6 group cursor-pointer",
                                                i ===
                                                    sortedHistory.length - 1 &&
                                                    "pb-0"
                                            )}
                                            onClick={() => {
                                                const pos =
                                                    getTimelinePosition(
                                                        entry.changed_at
                                                    );
                                                setSliderValue(pos);
                                                fetchTimeTravelState(
                                                    entry.changed_at
                                                );
                                            }}
                                        >
                                            {/* Dot */}
                                            <div
                                                className={cn(
                                                    "absolute left-[-15px] top-1 h-3 w-3 rounded-full ring-[3px] ring-background transition-all duration-200",
                                                    config?.dotColor ||
                                                        "bg-foreground/30",
                                                    isActive
                                                        ? "scale-125 ring-primary/20"
                                                        : "group-hover:scale-110"
                                                )}
                                            />

                                            {/* Content */}
                                            <div
                                                className={cn(
                                                    "glass-subtle rounded-xl p-3 transition-all duration-200",
                                                    isActive
                                                        ? "ring-1 ring-primary/30 bg-primary/[0.03]"
                                                        : "group-hover:bg-foreground/[0.02]"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span
                                                        className={cn(
                                                            "px-2 py-0.5 rounded-full text-[10px] font-medium",
                                                            config?.color ||
                                                                "bg-foreground/[0.04]"
                                                        )}
                                                    >
                                                        {config?.label ||
                                                            entry.change_type}
                                                    </span>
                                                    <span className="text-[11px] text-muted-foreground">
                                                        {formatDate(
                                                            entry.changed_at
                                                        )}
                                                    </span>
                                                </div>

                                                {/* Inline diff preview */}
                                                <div className="grid grid-cols-2 gap-3 text-[11px]">
                                                    {entry.previous_data && (
                                                        <div>
                                                            <h4 className="text-[10px] font-medium text-muted-foreground mb-1">
                                                                이전
                                                            </h4>
                                                            <pre className="bg-destructive/5 p-2 rounded-lg overflow-auto max-h-28 font-mono">
                                                                {JSON.stringify(
                                                                    entry.previous_data,
                                                                    null,
                                                                    2
                                                                )}
                                                            </pre>
                                                        </div>
                                                    )}
                                                    {entry.new_data && (
                                                        <div>
                                                            <h4 className="text-[10px] font-medium text-muted-foreground mb-1">
                                                                이후
                                                            </h4>
                                                            <pre className="bg-emerald-500/5 p-2 rounded-lg overflow-auto max-h-28 font-mono">
                                                                {JSON.stringify(
                                                                    entry.new_data,
                                                                    null,
                                                                    2
                                                                )}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Restore Confirmation Dialog ───────────────────── */}
            <Dialog
                open={restoreDialogOpen}
                onOpenChange={setRestoreDialogOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            상태 복원 확인
                        </DialogTitle>
                        <DialogDescription className="text-sm">
                            {timeTravelTimestamp && (
                                <>
                                    <strong>
                                        {formatDate(timeTravelTimestamp)}
                                    </strong>{" "}
                                    시점의 상태로 복원합니다.
                                    <br />이 작업은 현재 상태를 덮어씁니다.
                                    계속하시겠습니까?
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRestoreDialogOpen(false)}
                        >
                            취소
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleRestore}
                            disabled={restoring}
                            className="gap-1.5"
                        >
                            {restoring ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            {restoring ? "복원 중..." : "복원하기"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
