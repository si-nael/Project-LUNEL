"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Schedule } from "@/types";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { CalendarClock, AlertTriangle, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function ImportanceBadge({ score }: { score: number }) {
    const variant =
        score >= 80
            ? "destructive"
            : score >= 60
                ? "default"
                : "secondary";
    return <Badge variant={variant}>{score}</Badge>;
}

function ScheduleCard({ schedule }: { schedule: Schedule }) {
    const now = new Date();
    const daysLeft = schedule.end_at
        ? Math.ceil(
            (new Date(schedule.end_at).getTime() - now.getTime()) / 86400000
        )
        : null;

    return (
        <Link
            href={`/dashboard/schedules/${schedule.id}`}
            className="block rounded-xl p-3.5 hover:bg-foreground/[0.02] transition-all duration-200"
        >
            <div className="flex items-start justify-between mb-1.5">
                <h3 className="text-sm font-medium text-foreground/80 truncate flex-1 mr-2">
                    {schedule.title}
                </h3>
                <ImportanceBadge score={schedule.importance_score} />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {schedule.type}
                </Badge>
                <span>
                    {new Date(schedule.start_at).toLocaleDateString("ko-KR")}
                </span>
                {daysLeft !== null && daysLeft > 0 && (
                    <span
                        className={cn(
                            "font-medium",
                            daysLeft <= 3
                                ? "text-destructive"
                                : "text-muted-foreground"
                        )}
                    >
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
            .catch(() => toast.error("일정을 불러올 수 없습니다."))
            .finally(() => setLoading(false));
    }, []);

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const todaySchedules = schedules.filter(
        (s) => s.start_at.slice(0, 10) === todayStr
    );
    const urgent = schedules
        .filter((s) => s.end_at && new Date(s.end_at) > now)
        .sort(
            (a, b) =>
                new Date(a.end_at!).getTime() - new Date(b.end_at!).getTime()
        )
        .slice(0, 5);
    const important = [...schedules]
        .sort((a, b) => b.importance_score - a.importance_score)
        .slice(0, 5);

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-xl font-semibold tracking-tight">
                    안녕하세요, {user?.name}님
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                    {now.toLocaleDateString("ko-KR", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    })}
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <CalendarClock className="h-3.5 w-3.5 text-primary/60" />
                                <CardTitle className="text-sm">
                                    오늘 일정
                                </CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                {todaySchedules.length}개의 일정
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {todaySchedules.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-4 text-center">
                                    오늘 일정이 없습니다.
                                </p>
                            ) : (
                                todaySchedules.map((s) => (
                                    <ScheduleCard key={s.id} schedule={s} />
                                ))
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-3.5 w-3.5 text-destructive/60" />
                                <CardTitle className="text-sm">
                                    마감 임박
                                </CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                마감이 가까운 일정
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {urgent.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-4 text-center">
                                    마감 임박 일정이 없습니다.
                                </p>
                            ) : (
                                urgent.map((s) => (
                                    <ScheduleCard key={s.id} schedule={s} />
                                ))
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Star className="h-3.5 w-3.5 text-amber-500/60" />
                                <CardTitle className="text-sm">
                                    중요 일정
                                </CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                중요도 높은 일정 Top 5
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {important.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-4 text-center">
                                    일정이 없습니다.
                                </p>
                            ) : (
                                important.map((s) => (
                                    <ScheduleCard key={s.id} schedule={s} />
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
