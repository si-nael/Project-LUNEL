"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface AdminStats {
    totalSchedules: number;
    totalProjects: number;
    totalGroups: number;
    topSchedules: { id: string; title: string; importance_score: number }[];
}

export default function AdminPage() {
    const { user } = useAuth();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            try {
                const [schedules, projects, groups] = await Promise.all([
                    api.get("/schedules"),
                    api.get("/projects"),
                    api.get("/groups"),
                ]);

                const allSchedules = schedules.data as {
                    id: string;
                    title: string;
                    importance_score: number;
                }[];
                const sorted = [...allSchedules]
                    .sort((a, b) => b.importance_score - a.importance_score)
                    .slice(0, 10);

                setStats({
                    totalSchedules: allSchedules.length,
                    totalProjects: (projects.data as unknown[]).length,
                    totalGroups: (groups.data as unknown[]).length,
                    topSchedules: sorted,
                });
            } catch {
                // not admin or fetch failed
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, []);

    if (user?.role !== "ADMIN" && user?.role !== "TEACHER") {
        return (
            <div className="text-center py-20">
                <p className="text-red-500 font-semibold">
                    관리자 또는 교사 권한이 필요합니다.
                </p>
            </div>
        );
    }

    if (loading) return <p className="text-gray-400">로딩 중...</p>;

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">
                운영 대시보드
            </h1>

            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <p className="text-sm text-gray-500">전체 일정</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                        {stats?.totalSchedules ?? 0}
                    </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <p className="text-sm text-gray-500">전체 프로젝트</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                        {stats?.totalProjects ?? 0}
                    </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <p className="text-sm text-gray-500">전체 그룹</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                        {stats?.totalGroups ?? 0}
                    </p>
                </div>
            </div>

            {/* Top importance schedules */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    중요도 상위 일정 (Top 10)
                </h2>
                {stats?.topSchedules.length === 0 ? (
                    <p className="text-sm text-gray-400">일정이 없습니다.</p>
                ) : (
                    <div className="space-y-2">
                        {stats?.topSchedules.map((s, i) => (
                            <div
                                key={s.id}
                                className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50"
                            >
                                <span className="text-sm font-bold text-gray-400 w-6">
                                    {i + 1}
                                </span>
                                <span className="text-sm text-gray-900 flex-1">
                                    {s.title}
                                </span>
                                <span className="text-sm font-semibold text-blue-600">
                                    {s.importance_score}점
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
