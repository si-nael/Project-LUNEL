"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { Schedule } from "@/types";
import Link from "next/link";

type ViewMode = "month" | "week";

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function getMonthGrid(year: number, month: number) {
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = getDaysInMonth(year, month);
    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = Array(firstDay).fill(null);

    for (let d = 1; d <= daysInMonth; d++) {
        week.push(d);
        if (week.length === 7) {
            weeks.push(week);
            week = [];
        }
    }
    if (week.length > 0) {
        while (week.length < 7) week.push(null);
        weeks.push(week);
    }
    return weeks;
}

function getWeekDates(baseDate: Date) {
    const start = new Date(baseDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
    });
}

function importanceColor(score: number) {
    if (score >= 80) return "bg-red-200 border-red-400 text-red-800";
    if (score >= 60) return "bg-orange-200 border-orange-400 text-orange-800";
    if (score >= 40) return "bg-blue-200 border-blue-400 text-blue-800";
    return "bg-gray-200 border-gray-300 text-gray-700";
}

export default function CalendarPage() {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [view, setView] = useState<ViewMode>("month");
    const [current, setCurrent] = useState(new Date());
    const [filterType, setFilterType] = useState<string>("");

    useEffect(() => {
        api.get<Schedule[]>("/schedules")
            .then(({ data }) => setSchedules(data))
            .catch(() => { });
    }, []);

    const filtered = useMemo(() => {
        if (!filterType) return schedules;
        return schedules.filter((s) => s.type === filterType);
    }, [schedules, filterType]);

    const schedulesByDate = useMemo(() => {
        const map: Record<string, Schedule[]> = {};
        for (const s of filtered) {
            const key = s.start_at.slice(0, 10);
            (map[key] ??= []).push(s);
        }
        return map;
    }, [filtered]);

    const year = current.getFullYear();
    const month = current.getMonth();

    const navigate = (dir: number) => {
        const next = new Date(current);
        if (view === "month") next.setMonth(next.getMonth() + dir);
        else next.setDate(next.getDate() + dir * 7);
        setCurrent(next);
    };

    const weekDates = view === "week" ? getWeekDates(current) : [];
    const monthGrid = view === "month" ? getMonthGrid(year, month) : [];

    const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">캘린더</h1>
                <div className="flex items-center gap-3">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                    >
                        <option value="">전체</option>
                        <option value="PROJECT">프로젝트</option>
                        <option value="INTERVAL">인터벌</option>
                        <option value="EVENT">이벤트</option>
                    </select>
                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setView("month")}
                            className={`px-3 py-1 rounded-md text-sm ${view === "month" ? "bg-white shadow" : "text-gray-500"}`}
                        >
                            월
                        </button>
                        <button
                            onClick={() => setView("week")}
                            className={`px-3 py-1 rounded-md text-sm ${view === "week" ? "bg-white shadow" : "text-gray-500"}`}
                        >
                            주
                        </button>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mb-4">
                <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800 px-3 py-1">
                    ← 이전
                </button>
                <h2 className="text-lg font-semibold">
                    {view === "month"
                        ? `${year}년 ${month + 1}월`
                        : `${weekDates[0]?.toLocaleDateString("ko-KR")} ~ ${weekDates[6]?.toLocaleDateString("ko-KR")}`}
                </h2>
                <button onClick={() => navigate(1)} className="text-gray-500 hover:text-gray-800 px-3 py-1">
                    다음 →
                </button>
            </div>

            {/* Month View */}
            {view === "month" && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="grid grid-cols-7">
                        {DAYS.map((d) => (
                            <div key={d} className="text-center text-xs font-medium text-gray-500 py-2 border-b border-gray-200">
                                {d}
                            </div>
                        ))}
                    </div>
                    {monthGrid.map((week, wi) => (
                        <div key={wi} className="grid grid-cols-7 min-h-[100px]">
                            {week.map((day, di) => {
                                const dateStr = day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
                                const daySchedules = dateStr ? schedulesByDate[dateStr] || [] : [];
                                const isToday = dateStr === new Date().toISOString().slice(0, 10);
                                return (
                                    <div
                                        key={di}
                                        className={`border-b border-r border-gray-100 p-1 ${day ? "" : "bg-gray-50"}`}
                                    >
                                        {day && (
                                            <>
                                                <div className={`text-xs mb-1 ${isToday ? "bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-full" : "text-gray-600 px-1"}`}>
                                                    {day}
                                                </div>
                                                {daySchedules.slice(0, 3).map((s) => (
                                                    <Link
                                                        key={s.id}
                                                        href={`/dashboard/schedules/${s.id}`}
                                                        className={`block text-xs px-1 py-0.5 mb-0.5 rounded border truncate ${importanceColor(s.importance_score)}`}
                                                    >
                                                        {s.title}
                                                    </Link>
                                                ))}
                                                {daySchedules.length > 3 && (
                                                    <div className="text-xs text-gray-400 px-1">+{daySchedules.length - 3}개</div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}

            {/* Week View */}
            {view === "week" && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="grid grid-cols-7">
                        {weekDates.map((d, i) => {
                            const dateStr = d.toISOString().slice(0, 10);
                            const daySchedules = schedulesByDate[dateStr] || [];
                            const isToday = dateStr === new Date().toISOString().slice(0, 10);
                            return (
                                <div key={i} className="border-r border-gray-100 min-h-[300px]">
                                    <div className={`text-center py-2 border-b ${isToday ? "bg-blue-50" : ""}`}>
                                        <div className="text-xs text-gray-500">{DAYS[i]}</div>
                                        <div className={`text-lg font-medium ${isToday ? "text-blue-600" : "text-gray-800"}`}>
                                            {d.getDate()}
                                        </div>
                                    </div>
                                    <div className="p-1 space-y-1">
                                        {daySchedules.map((s) => (
                                            <Link
                                                key={s.id}
                                                href={`/dashboard/schedules/${s.id}`}
                                                className={`block text-xs p-1.5 rounded border ${importanceColor(s.importance_score)}`}
                                            >
                                                <div className="font-medium truncate">{s.title}</div>
                                                <div className="text-[10px] opacity-75">
                                                    {new Date(s.start_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
