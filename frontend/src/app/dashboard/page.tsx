"use client";

import { useEffect, useState, useMemo } from "react";
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
import { Button } from "@/components/ui/button";
import {
    CalendarClock,
    AlertTriangle,
    Zap,
    TrendingUp,
    Clock,
    Users,
    BookOpen,
    Shield,
    ChevronRight,
    Plus,
    TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ── helpers ── */

function daysUntil(dateStr: string) {
    return Math.ceil(
        (new Date(dateStr).getTime() - Date.now()) / 86400000
    );
}

function hoursUntil(dateStr: string) {
    return Math.max(0, (new Date(dateStr).getTime() - Date.now()) / 3600000);
}

function timeRangesOverlap(
    a: { start: string; end: string | null },
    b: { start: string; end: string | null }
) {
    const aStart = new Date(a.start).getTime();
    const aEnd = a.end ? new Date(a.end).getTime() : aStart + 3600000;
    const bStart = new Date(b.start).getTime();
    const bEnd = b.end ? new Date(b.end).getTime() : bStart + 3600000;
    return aStart < bEnd && bStart < aEnd;
}

const TYPE_ICONS: Record<string, typeof BookOpen> = {
    PROJECT: BookOpen,
    INTERVAL: Clock,
    EVENT: Users,
};

const TYPE_LABELS: Record<string, string> = {
    PROJECT: "프로젝트",
    INTERVAL: "인터벌",
    EVENT: "이벤트",
};

/* ── Importance breakdown bar ── */
function ImportanceBar({ schedule }: { schedule: Schedule }) {
    const segments = [
        { key: "base", label: "기본", value: schedule.base_importance, max: 100, color: "bg-blue-500" },
        { key: "auth", label: "권위", value: schedule.authority_weight, max: 30, color: "bg-violet-500" },
        { key: "urgency", label: "긴급", value: schedule.urgency_weight, max: 20, color: "bg-red-500" },
        { key: "feedback", label: "피드백", value: schedule.feedback_weight, max: 20, color: "bg-amber-500" },
        { key: "dep", label: "의존", value: schedule.dependency_weight, max: 10, color: "bg-emerald-500" },
    ];
    const total = schedule.importance_score;
    const maxTotal = 180;

    return (
        <div className="space-y-1">
            {/* Stacked bar */}
            <div className="flex h-2 rounded-full overflow-hidden bg-foreground/[0.04]">
                {segments.map((s) =>
                    s.value > 0 ? (
                        <div
                            key={s.key}
                            className={cn(s.color, "transition-all")}
                            style={{ width: `${(s.value / maxTotal) * 100}%` }}
                            title={`${s.label}: ${s.value}`}
                        />
                    ) : null
                )}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-2 flex-wrap">
                {segments.filter((s) => s.value > 0).map((s) => (
                    <span key={s.key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span className={cn("w-1.5 h-1.5 rounded-full", s.color)} />
                        {s.label} {s.value}
                    </span>
                ))}
                <span className="ml-auto text-xs font-bold text-foreground">{total}</span>
            </div>
        </div>
    );
}

/* ── Priority card with WHY ── */
function PriorityItem({ schedule, rank }: { schedule: Schedule; rank: number }) {
    const d = schedule.end_at ? daysUntil(schedule.end_at) : null;
    const h = schedule.end_at ? hoursUntil(schedule.end_at) : null;
    const Icon = TYPE_ICONS[schedule.type] || CalendarClock;

    // Generate "why" reason
    const reasons: string[] = [];
    if (schedule.urgency_weight >= 16) reasons.push("마감 임박");
    if (schedule.authority_weight >= 15) reasons.push("교사 강조");
    if (schedule.feedback_weight >= 10) reasons.push("높은 피드백");
    if (schedule.base_importance >= 70) reasons.push("높은 기본 중요도");

    return (
        <Link
            href={`/dashboard/schedules/${schedule.id}`}
            className="block group"
        >
            <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-foreground/[0.02] transition-all">
                {/* Rank */}
                <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                    rank === 1 ? "bg-primary text-primary-foreground" :
                        rank <= 3 ? "bg-primary/10 text-primary" :
                            "bg-foreground/[0.04] text-muted-foreground"
                )}>
                    {rank}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <h3 className="text-sm font-medium truncate">{schedule.title}</h3>
                    </div>

                    {/* Importance breakdown */}
                    <ImportanceBar schedule={schedule} />

                    {/* Meta row */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {TYPE_LABELS[schedule.type] || schedule.type}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                            {new Date(schedule.start_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                        </span>
                        {d !== null && d > 0 && (
                            <span className={cn(
                                "text-[11px] font-semibold",
                                d <= 1 ? "text-red-500" :
                                    d <= 3 ? "text-orange-500" :
                                        "text-muted-foreground"
                            )}>
                                {h !== null && h < 24
                                    ? `${Math.ceil(h)}시간 남음`
                                    : `D-${d}`}
                            </span>
                        )}
                        {reasons.length > 0 && (
                            <span className="text-[10px] text-primary/70 font-medium">
                                {reasons[0]}
                            </span>
                        )}
                    </div>
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
            </div>
        </Link>
    );
}

/* ── Conflict alert ── */
function ConflictAlert({ conflicts }: { conflicts: [Schedule, Schedule][] }) {
    if (conflicts.length === 0) return null;
    return (
        <Card className="border-orange-500/20 bg-orange-500/[0.03]">
            <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                    <TriangleAlert className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-semibold text-orange-600">
                        일정 충돌 감지 ({conflicts.length}건)
                    </span>
                </div>
                <div className="space-y-1.5">
                    {conflicts.slice(0, 3).map(([a, b], i) => (
                        <div key={i} className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{a.title}</span>
                            {" ↔ "}
                            <span className="font-medium text-foreground">{b.title}</span>
                            <span className="ml-1 text-orange-500">
                                ({new Date(a.start_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })})
                            </span>
                        </div>
                    ))}
                    {conflicts.length > 3 && (
                        <p className="text-[11px] text-muted-foreground">외 {conflicts.length - 3}건 더...</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

/* ── Weekday workload heatmap ── */
function WorkloadHeatmap({ schedules }: { schedules: Schedule[] }) {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);

    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        return d;
    });

    const dayLabels = ["월", "화", "수", "목", "금", "토", "일"];
    const counts = days.map((day) => {
        const dayStr = day.toISOString().slice(0, 10);
        return schedules.filter((s) => {
            const sDate = s.start_at.slice(0, 10);
            const eDate = s.end_at ? s.end_at.slice(0, 10) : sDate;
            return sDate <= dayStr && eDate >= dayStr;
        }).length;
    });
    const maxCount = Math.max(...counts, 1);
    const todayIdx = (now.getDay() + 6) % 7; // 0=Mon

    return (
        <div className="flex gap-1.5 items-end h-16">
            {counts.map((c, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                        className={cn(
                            "w-full rounded-md transition-all",
                            i === todayIdx ? "bg-primary" :
                                c === 0 ? "bg-foreground/[0.04]" :
                                    c / maxCount > 0.7 ? "bg-red-400/60" :
                                        c / maxCount > 0.4 ? "bg-amber-400/50" :
                                            "bg-emerald-400/40"
                        )}
                        style={{ height: `${Math.max(4, (c / maxCount) * 40)}px` }}
                    />
                    <span className={cn(
                        "text-[10px]",
                        i === todayIdx ? "font-bold text-primary" : "text-muted-foreground"
                    )}>
                        {dayLabels[i]}
                    </span>
                </div>
            ))}
        </div>
    );
}

/* ── Weekly summary stat ── */
function WeekSummary({ schedules }: { schedules: Schedule[] }) {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const thisWeek = schedules.filter((s) => {
        const d = new Date(s.start_at);
        return d >= startOfWeek && d < endOfWeek;
    });

    const deadlines = thisWeek.filter(
        (s) => s.end_at && new Date(s.end_at) >= now && new Date(s.end_at) < endOfWeek
    ).length;

    const avgImportance = thisWeek.length > 0
        ? Math.round(thisWeek.reduce((sum, s) => sum + s.importance_score, 0) / thisWeek.length)
        : 0;

    return (
        <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 rounded-lg bg-foreground/[0.02]">
                <div className="text-lg font-bold">{thisWeek.length}</div>
                <div className="text-[10px] text-muted-foreground">이번 주 일정</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-foreground/[0.02]">
                <div className={cn("text-lg font-bold", deadlines > 0 ? "text-red-500" : "")}>{deadlines}</div>
                <div className="text-[10px] text-muted-foreground">이번 주 마감</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-foreground/[0.02]">
                <div className="text-lg font-bold">{avgImportance}</div>
                <div className="text-[10px] text-muted-foreground">평균 중요도</div>
            </div>
        </div>
    );
}

/* ════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ════════════════════════════════════════════════════════════════ */
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

    /* ── Derived data ── */

    // Smart priority: active schedules ranked by importance (system tells you what matters)
    const prioritized = useMemo(() =>
        schedules
            .filter((s) => s.status !== "COMPLETED" && s.status !== "CANCELLED")
            .filter((s) => !s.end_at || new Date(s.end_at) > now)
            .sort((a, b) => b.importance_score - a.importance_score)
            .slice(0, 7),
        [schedules]
    );

    // Conflict detection: overlapping time ranges (Google Calendar can't do this)
    const conflicts = useMemo(() => {
        const active = schedules.filter(
            (s) => s.status !== "COMPLETED" && s.status !== "CANCELLED"
        );
        const pairs: [Schedule, Schedule][] = [];
        for (let i = 0; i < active.length; i++) {
            for (let j = i + 1; j < active.length; j++) {
                const a = active[i], b = active[j];
                if (
                    a.start_at.slice(0, 10) === b.start_at.slice(0, 10) &&
                    timeRangesOverlap(
                        { start: a.start_at, end: a.end_at },
                        { start: b.start_at, end: b.end_at }
                    )
                ) {
                    pairs.push([a, b]);
                }
            }
        }
        return pairs;
    }, [schedules]);

    // Imminent deadlines (within 48 hours)
    const imminent = useMemo(() =>
        schedules
            .filter((s) => s.end_at && s.status !== "COMPLETED" && s.status !== "CANCELLED")
            .filter((s) => {
                const h = hoursUntil(s.end_at!);
                return h > 0 && h <= 48;
            })
            .sort((a, b) => new Date(a.end_at!).getTime() - new Date(b.end_at!).getTime()),
        [schedules]
    );

    return (
        <div>
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">
                        {user?.name}님, 지금 중요한 것
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        {now.toLocaleDateString("ko-KR", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                        {" · "}
                        활성 일정 {prioritized.length}건
                        {conflicts.length > 0 && (
                            <span className="text-orange-500 font-medium"> · 충돌 {conflicts.length}건</span>
                        )}
                    </p>
                </div>
                <Button asChild size="sm">
                    <Link href="/dashboard/schedules/new">
                        <Plus className="h-4 w-4 mr-1" />
                        새 일정
                    </Link>
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Conflict alert — Google Calendar doesn't do this */}
                    <ConflictAlert conflicts={conflicts} />

                    {/* Imminent deadlines banner */}
                    {imminent.length > 0 && (
                        <Card className="border-red-500/20 bg-red-500/[0.03]">
                            <CardContent className="pt-4 pb-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                    <span className="text-sm font-semibold text-red-600">
                                        48시간 이내 마감 ({imminent.length}건)
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    {imminent.map((s) => {
                                        const h = Math.ceil(hoursUntil(s.end_at!));
                                        return (
                                            <Link
                                                key={s.id}
                                                href={`/dashboard/schedules/${s.id}`}
                                                className="flex items-center justify-between text-xs hover:bg-foreground/[0.02] rounded-lg px-2 py-1.5 transition-all"
                                            >
                                                <span className="font-medium">{s.title}</span>
                                                <span className={cn(
                                                    "font-bold",
                                                    h <= 6 ? "text-red-600" : "text-red-400"
                                                )}>
                                                    {h}시간 남음
                                                </span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* LEFT: Smart Priority — THE core feature */}
                        <div className="lg:col-span-2">
                            <Card>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-primary" />
                                        <CardTitle className="text-sm">지금 집중해야 할 것</CardTitle>
                                    </div>
                                    <CardDescription className="text-xs">
                                        중요도 시스템이 자동으로 우선순위를 결정합니다
                                        — 기본값 + 교사 가중치 + 마감 긴급도 + 동료 피드백 + 의존성
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {prioritized.length === 0 ? (
                                        <div className="text-center py-8">
                                            <p className="text-sm text-muted-foreground mb-3">
                                                활성 일정이 없습니다.
                                            </p>
                                            <Button asChild variant="outline" size="sm">
                                                <Link href="/dashboard/schedules/new">
                                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                                    첫 일정 만들기
                                                </Link>
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-border/40">
                                            {prioritized.map((s, i) => (
                                                <PriorityItem
                                                    key={s.id}
                                                    schedule={s}
                                                    rank={i + 1}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* RIGHT: This week overview */}
                        <div className="space-y-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="h-3.5 w-3.5 text-primary/60" />
                                        <CardTitle className="text-sm">이번 주 요약</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <WeekSummary schedules={schedules} />
                                    <WorkloadHeatmap schedules={schedules} />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2">
                                        <Shield className="h-3.5 w-3.5 text-primary/60" />
                                        <CardTitle className="text-sm">중요도 점수란?</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                                        루넬은 5가지 요소를 결합해 일정의 진짜 중요도를 자동 계산합니다.
                                        구글 캘린더는 일정이 평등하지만, 루넬은 뭐가 중요한지 알려줍니다.
                                    </p>
                                    <div className="space-y-1.5 text-[11px]">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                                            <span className="text-muted-foreground">기본 (1-100)</span>
                                            <span className="ml-auto text-foreground">내가 설정</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-violet-500" />
                                            <span className="text-muted-foreground">권위 (0-30)</span>
                                            <span className="ml-auto text-foreground">교사가 강조</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-red-500" />
                                            <span className="text-muted-foreground">긴급도 (0-20)</span>
                                            <span className="ml-auto text-foreground">마감 접근 시 ↑</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                                            <span className="text-muted-foreground">피드백 (0-20)</span>
                                            <span className="ml-auto text-foreground">동료 평가 반영</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <span className="text-muted-foreground">의존성 (0-10)</span>
                                            <span className="ml-auto text-foreground">프로젝트 연계</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
