"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Schedule } from "@/types";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
    DRAFT: "초안",
    SCHEDULED: "예정",
    IN_PROGRESS: "진행 중",
    COMPLETED: "완료",
    CANCELLED: "취소",
};

const TYPE_LABELS: Record<string, string> = {
    PROJECT: "프로젝트",
    INTERVAL: "인터벌",
    EVENT: "이벤트",
};

export default function SchedulesPage() {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState("");
    const [filterStatus, setFilterStatus] = useState("");

    useEffect(() => {
        const params = new URLSearchParams();
        if (filterType) params.set("type", filterType);
        if (filterStatus) params.set("status", filterStatus);
        api.get<Schedule[]>(`/schedules?${params}`)
            .then(({ data }) => setSchedules(data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [filterType, filterStatus]);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">일정 목록</h1>
                <Link
                    href="/dashboard/schedules/new"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                    + 새 일정
                </Link>
            </div>

            <div className="flex gap-3 mb-4">
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                >
                    <option value="">전체 타입</option>
                    <option value="PROJECT">프로젝트</option>
                    <option value="INTERVAL">인터벌</option>
                    <option value="EVENT">이벤트</option>
                </select>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                >
                    <option value="">전체 상태</option>
                    <option value="SCHEDULED">예정</option>
                    <option value="IN_PROGRESS">진행 중</option>
                    <option value="COMPLETED">완료</option>
                    <option value="CANCELLED">취소</option>
                </select>
            </div>

            {loading ? (
                <p className="text-gray-400">로딩 중...</p>
            ) : schedules.length === 0 ? (
                <p className="text-gray-400">일정이 없습니다.</p>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    {schedules.map((s) => (
                        <Link
                            key={s.id}
                            href={`/dashboard/schedules/${s.id}`}
                            className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-medium text-gray-900 truncate">{s.title}</h3>
                                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                                        {TYPE_LABELS[s.type] || s.type}
                                    </span>
                                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                                        {STATUS_LABELS[s.status] || s.status}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500">
                                    {new Date(s.start_at).toLocaleString("ko-KR")}
                                    {s.end_at && ` ~ ${new Date(s.end_at).toLocaleString("ko-KR")}`}
                                    {s.location && ` · ${s.location}`}
                                </div>
                            </div>
                            <div className="ml-4 text-right">
                                <div className={`text-lg font-bold ${s.importance_score >= 80 ? "text-red-600" : s.importance_score >= 60 ? "text-orange-600" : "text-blue-600"}`}>
                                    {s.importance_score}
                                </div>
                                <div className="text-[10px] text-gray-400">중요도</div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
