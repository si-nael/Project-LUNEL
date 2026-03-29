"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { api } from "@/lib/api";
import { Schedule } from "@/types";
import { toast } from "sonner";
import Link from "next/link";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const FILTER_OPTIONS = [
    { value: "all", label: "전체" },
    { value: "PROJECT", label: "프로젝트" },
    { value: "INTERVAL", label: "인터벌" },
    { value: "EVENT", label: "이벤트" },
];

function importanceColor(score: number): string {
    if (score >= 80) return "bg-red-500/15 text-red-700 border-red-500/20";
    if (score >= 50)
        return "bg-amber-500/15 text-amber-700 border-amber-500/20";
    return "bg-primary/8 text-primary border-primary/15";
}

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<"month" | "week">("month");
    const [filter, setFilter] = useState("all");
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    useEffect(() => {
        api.get<Schedule[]>("/schedules")
            .then(({ data }) => setSchedules(data))
            .catch(() => toast.error("일정을 불러올 수 없습니다."))
            .finally(() => setLoading(false));
    }, []);

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

    const schedulesForDay = useCallback(
        (date: Date | null) => {
            if (!date) return [];
            const dateStr = date.toISOString().slice(0, 10);
            return schedules.filter((s) => {
                if (filter !== "all" && s.type !== filter) return false;
                const start = s.start_at.slice(0, 10);
                const end = s.end_at ? s.end_at.slice(0, 10) : start;
                return dateStr >= start && dateStr <= end;
            });
        },
        [schedules, filter]
    );

    const today = new Date().toISOString().slice(0, 10);

    const selectedSchedules = selectedDate
        ? schedules.filter((s) => {
            const start = s.start_at.slice(0, 10);
            const end = s.end_at ? s.end_at.slice(0, 10) : start;
            return selectedDate >= start && selectedDate <= end;
        })
        : [];

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-semibold tracking-tight">
                    캘린더
                </h1>
                <div className="flex items-center gap-1">
                    {FILTER_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setFilter(opt.value)}
                            className={`px-3 py-1.5 text-xs rounded-lg transition-all ${filter === opt.value
                                    ? "bg-primary text-primary-foreground font-medium"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
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
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary"
                    >
                        ←
                    </button>
                    <span className="text-base font-semibold min-w-[120px] text-center">
                        {year}년 {month + 1}월
                    </span>
                    <button
                        onClick={goToNext}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary"
                    >
                        →
                    </button>
                </div>
                <div className="flex items-center rounded-lg border border-border overflow-hidden">
                    <button
                        onClick={() => setViewMode("month")}
                        className={`px-3 py-1.5 text-xs transition-all ${viewMode === "month"
                                ? "bg-primary text-primary-foreground font-medium"
                                : "text-muted-foreground hover:bg-secondary"
                            }`}
                    >
                        월
                    </button>
                    <button
                        onClick={() => setViewMode("week")}
                        className={`px-3 py-1.5 text-xs transition-all ${viewMode === "week"
                                ? "bg-primary text-primary-foreground font-medium"
                                : "text-muted-foreground hover:bg-secondary"
                            }`}
                    >
                        주
                    </button>
                </div>
            </div>

            <div className="glass rounded-2xl overflow-hidden">
                <div className="grid grid-cols-7 border-b border-border/50">
                    {DAY_NAMES.map((day, i) => (
                        <div
                            key={i}
                            className={`text-center py-2.5 text-xs font-medium ${i === 0
                                    ? "text-red-600"
                                    : i === 6
                                        ? "text-blue-600"
                                        : "text-muted-foreground"
                                }`}
                        >
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {calendarDays.map((date, i) => {
                        const dateStr = date?.toISOString().slice(0, 10) ?? "";
                        const daySchedules = schedulesForDay(date);
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
                                className={`min-h-[88px] p-1.5 border-t border-border/30 cursor-pointer transition-colors hover:bg-secondary/50 ${!date ? "bg-muted/30" : ""
                                    } ${isSelected ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""}`}
                            >
                                {date && (
                                    <>
                                        <span
                                            className={`inline-flex items-center justify-center text-xs w-6 h-6 rounded-full font-medium ${isToday
                                                    ? "bg-primary text-primary-foreground"
                                                    : dayOfWeek === 0
                                                        ? "text-red-600"
                                                        : dayOfWeek === 6
                                                            ? "text-blue-600"
                                                            : "text-foreground"
                                                }`}
                                        >
                                            {dayNum}
                                        </span>
                                        <div className="mt-0.5 space-y-0.5">
                                            {daySchedules
                                                .slice(0, 2)
                                                .map((s) => (
                                                    <div
                                                        key={s.id}
                                                        className={`text-[10px] px-1.5 py-0.5 rounded border truncate ${importanceColor(s.importance_score)}`}
                                                    >
                                                        {s.title}
                                                    </div>
                                                ))}
                                            {daySchedules.length > 2 && (
                                                <span className="text-[10px] text-muted-foreground pl-1">
                                                    +{daySchedules.length - 2}건
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

            {selectedDate && selectedSchedules.length > 0 && (
                <div className="mt-4 glass rounded-2xl p-4">
                    <h2 className="text-sm font-semibold mb-3">
                        {selectedDate} 일정 ({selectedSchedules.length})
                    </h2>
                    <div className="space-y-2">
                        {selectedSchedules.map((s) => (
                            <Link
                                key={s.id}
                                href={`/dashboard/schedules/${s.id}`}
                                className="flex items-center justify-between p-3 rounded-xl hover:bg-secondary/50 transition-colors"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">
                                        {s.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(s.start_at).toLocaleTimeString(
                                            "ko-KR",
                                            {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            }
                                        )}
                                        {s.location && ` · ${s.location}`}
                                    </p>
                                </div>
                                <span
                                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${importanceColor(s.importance_score)}`}
                                >
                                    {s.importance_score}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
