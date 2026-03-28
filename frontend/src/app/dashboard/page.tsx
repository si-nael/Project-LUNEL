"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Schedule } from "@/types";
import Link from "next/link";

function ImportanceBadge({ score }: { score: number }) {
    let color = "bg-gray-100 text-gray-600";
    if (score >= 80) color = "bg-red-100 text-red-700";
    else if (score >= 60) color = "bg-orange-100 text-orange-700";
    else if (score >= 40) color = "bg-blue-100 text-blue-700";
    return (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
            {score}
        </span>
    );
}

function ScheduleCard({ schedule }: { schedule: Schedule }) {
    const startDate = new Date(schedule.start_at);
    const now = new Date();
    const daysLeft = schedule.end_at
        ? Math.ceil((new Date(schedule.end_at).getTime() - now.getTime()) / 86400000)
        : null;

    return (
        <Link
            href={`/dashboard/schedules/${schedule.id}`}
            className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
        >
            <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-gray-900 truncate flex-1">{schedule.title}</h3>
                <ImportanceBadge score={schedule.importance_score} />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="px-2 py-0.5 bg-gray-100 rounded">{schedule.type}</span>
                <span>{startDate.toLocaleDateString("ko-KR")}</span>
                {daysLeft !== null && daysLeft > 0 && (
                    <span className={daysLeft <= 3 ? "text-red-500 font-medium" : ""}>
                        D-{daysLeft}
                    </span>
                )}
            </div>
        </Link>
    );
}

export default function DashboardPage() {
    const { user } = useAuth();
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get<Schedule[]>("/schedules")
            .then(({ data }) => setSchedules(data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const todaySchedules = schedules.filter((s) => s.start_at.slice(0, 10) === todayStr);
    const urgent = schedules
        .filter((s) => s.end_at && new Date(s.end_at) > now)
        .sort((a, b) => new Date(a.end_at!).getTime() - new Date(b.end_at!).getTime())
        .slice(0, 5);
    const important = [...schedules]
        .sort((a, b) => b.importance_score - a.importance_score)
        .slice(0, 5);

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
                안녕하세요, {user?.name}님
            </h1>
            <p className="text-gray-500 mb-8">
                {now.toLocaleDateString("ko-KR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>

            {loading ? (
                <div className="text-gray-400">일정 불러오는 중...</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Today */}
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">오늘 일정</h2>
                        {todaySchedules.length === 0 ? (
                            <p className="text-gray-400 text-sm">오늘 일정이 없습니다.</p>
                        ) : (
                            <div className="space-y-3">
                                {todaySchedules.map((s) => (
                                    <ScheduleCard key={s.id} schedule={s} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Urgent */}
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">마감 임박</h2>
                        {urgent.length === 0 ? (
                            <p className="text-gray-400 text-sm">마감 임박 일정이 없습니다.</p>
                        ) : (
                            <div className="space-y-3">
                                {urgent.map((s) => (
                                    <ScheduleCard key={s.id} schedule={s} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Important */}
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">중요 일정</h2>
                        {important.length === 0 ? (
                            <p className="text-gray-400 text-sm">일정이 없습니다.</p>
                        ) : (
                            <div className="space-y-3">
                                {important.map((s) => (
                                    <ScheduleCard key={s.id} schedule={s} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
