"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

interface ScheduleEvent {
    id: number;
    title: string;
    start_time: string;
    end_time: string;
    type: string;
    subtype: string;
    importance: number;
}

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const FILTER_OPTIONS = [
    { value: "all", label: "전체" },
    { value: "project", label: "프로젝트" },
    { value: "interval", label: "인터벌" },
    { value: "event", label: "이벤트" },
];

function importanceColor(importance: number): string {
    if (importance >= 8) return "bg-red-500/15 text-red-600 border-red-500/20";
    if (importance >= 5)
        return "bg-amber-500/15 text-amber-600 border-amber-500/20";
    return "bg-foreground/[0.04] text-foreground/60 border-border/40";
}

export default function CalendarPage() {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<"month" | "week">("month");
    const [filter, setFilter] = useState("all");
    const [events, setEvents] = useState<ScheduleEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const goToPrev = () => {
        const d = new Date(currentDate);
        if (viewMode === "month") d.setMonth(d.getMonth() - 1);
        else d.setDate(d.getDate() - 7);
        setCurrentDate(d);
    };
    const goToNext = () => {
        const d = new Date(currentDate);
        if (viewMode === "month") d.setMonth(d.getMonth() + 1);
        else d.setDate(d.getDate() + 7);
        setCurrentDate(d);
    };

    const calendarDays = useMemo(() => {
        if (viewMode === "week") {
            const start = new Date(currentDate);
            start.setDate(start.getDate() - start.getDay());
            return Array.from({ length: 7 }, (_, i) => {
                const d = new Date(start);
                d.setDate(d.getDate() + i);
                return d;
            });
        }
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days: (Date | null)[] = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let d = 1; d <= daysInMonth; d++)
            days.push(new Date(year, month, d));
        while (days.length % 7 !== 0) days.push(null);
        return days;
    }, [currentDate, viewMode, year, month]);

    const eventsForDay = (date: Date | null) => {
        if (!date) return [];
        const dateStr = date.toISOString().slice(0, 10);
        return events.filter((e) => {
            if (filter !== "all" && e.type !== filter) return false;
            const start = e.start_time.slice(0, 10);
            const end = e.end_time.slice(0, 10);
            return dateStr >= start && dateStr <= end;
        });
    };

    const today = new Date().toISOString().slice(0, 10);

    // Load events (simplified — could use useEffect with API call)
    // useEffect to fetch events would go here in production

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-semibold tracking-tight">
                    캘린더
                </h1>
                <div className="flex items-center gap-2">
                    {FILTER_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setFilter(opt.value)}
                            className={`px-3 py-1 text-[11px] rounded-full transition-all ${filter === opt.value
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-foreground/50 hover:text-foreground/70 hover:bg-foreground/[0.03]"
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={goToPrev}
                        className="text-xs text-foreground/50 hover:text-foreground/80 transition-colors"
                    >
                        ← 이전
                    </button>
                    <span className="text-sm font-medium">
                        {year}년 {month + 1}월
                    </span>
                    <button
                        onClick={goToNext}
                        className="text-xs text-foreground/50 hover:text-foreground/80 transition-colors"
                    >
                        다음 →
                    </button>
                </div>
                <div className="flex items-center rounded-xl border border-border/60 overflow-hidden">
                    <button
                        onClick={() => setViewMode("month")}
                        className={`px-3 py-1 text-[11px] transition-all ${viewMode === "month"
                                ? "bg-foreground/[0.06] font-medium"
                                : "text-foreground/50 hover:bg-foreground/[0.03]"
                            }`}
                    >
                        월
                    </button>
                    <button
                        onClick={() => setViewMode("week")}
                        className={`px-3 py-1 text-[11px] transition-all ${viewMode === "week"
                                ? "bg-foreground/[0.06] font-medium"
                                : "text-foreground/50 hover:bg-foreground/[0.03]"
                            }`}
                    >
                        주
                    </button>
                </div>
            </div>

            <div className="glass rounded-2xl overflow-hidden">
                <div className="grid grid-cols-7 bg-foreground/[0.03]">
                    {DAY_NAMES.map((day, i) => (
                        <div
                            key={i}
                            className={`text-center py-2 text-[11px] font-medium ${i === 0
                                    ? "text-red-500/70"
                                    : i === 6
                                        ? "text-blue-500/70"
                                        : "text-foreground/50"
                                }`}
                        >
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {calendarDays.map((date, i) => {
                        const dateStr = date?.toISOString().slice(0, 10) ?? "";
                        const dayEvents = eventsForDay(date);
                        const isToday = dateStr === today;
                        const isSelected = dateStr === selectedDate;
                        const dayNum = date?.getDate();
                        const dayOfWeek = i % 7;

                        return (
                            <div
                                key={i}
                                onClick={() =>
                                    date && setSelectedDate(dateStr)
                                }
                                className={`min-h-[80px] p-1.5 border-t border-border/20 cursor-pointer transition-all hover:bg-foreground/[0.02] ${!date ? "bg-foreground/[0.01]" : ""
                                    } ${isSelected ? "bg-primary/[0.04]" : ""}`}
                            >
                                {date && (
                                    <>
                                        <span
                                            className={`inline-flex items-center justify-center text-[11px] w-5 h-5 rounded-full ${isToday
                                                    ? "bg-primary text-primary-foreground font-semibold"
                                                    : dayOfWeek === 0
                                                        ? "text-red-500/70"
                                                        : dayOfWeek === 6
                                                            ? "text-blue-500/70"
                                                            : "text-foreground/60"
                                                }`}
                                        >
                                            {dayNum}
                                        </span>
                                        <div className="mt-0.5 space-y-0.5">
                                            {dayEvents
                                                .slice(0, 2)
                                                .map((evt) => (
                                                    <div
                                                        key={evt.id}
                                                        className={`text-[9px] px-1 py-0.5 rounded border truncate ${importanceColor(evt.importance)}`}
                                                    >
                                                        {evt.title}
                                                    </div>
                                                ))}
                                            {dayEvents.length > 2 && (
                                                <span className="text-[9px] text-foreground/40 pl-1">
                                                    +{dayEvents.length - 2}건
                                                </span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
