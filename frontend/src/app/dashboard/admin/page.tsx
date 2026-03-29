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
                <p className="text-destructive text-sm">
                    관리자 또는 교사 권한이 필요합니다.
                </p>
            </div>
        );
    }

    if (loading)
        return (
            <div className="flex justify-center py-20">
                <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            </div>
        );

    return (
        <div>
            <h1 className="text-xl font-semibold tracking-tight mb-6">
                운영 대시보드
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="glass rounded-2xl p-5">
                    <p className="text-xs text-muted-foreground">전체 일정</p>
                    <p className="text-2xl font-semibold text-foreground mt-1">
                        {stats?.totalSchedules ?? 0}
                    </p>
                </div>
                <div className="glass rounded-2xl p-5">
                    <p className="text-xs text-muted-foreground">전체 프로젝트</p>
                    <p className="text-2xl font-semibold text-foreground mt-1">
                        {stats?.totalProjects ?? 0}
                    </p>
                </div>
                <div className="glass rounded-2xl p-5">
                    <p className="text-xs text-muted-foreground">전체 그룹</p>
                    <p className="text-2xl font-semibold text-foreground mt-1">
                        {stats?.totalGroups ?? 0}
                    </p>
                </div>
            </div>

            <div className="glass rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">
                    중요도 상위 일정 (Top 10)
                </h2>
                {stats?.topSchedules.length === 0 ? (
                    <p className="text-xs text-muted-foreground">일정이 없습니다.</p>
                ) : (
                    <div className="space-y-1">
                        {stats?.topSchedules.map((s, i) => (
                            <div
                                key={s.id}
                                className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-foreground/[0.02] transition-all duration-200"
                            >
                                <span className="text-xs font-medium text-muted-foreground w-5">
                                    {i + 1}
                                </span>
                                <span className="text-sm text-foreground flex-1">
                                    {s.title}
                                </span>
                                <span className="text-xs font-medium text-primary">
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
