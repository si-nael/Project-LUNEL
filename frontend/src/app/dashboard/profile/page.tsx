"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Schedule, Project } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    CheckCircle2, Flame, Star, Target, Calendar,
    BookOpen, Users, Lock, Plus,
} from "lucide-react";

/* ─────────────────────────────── TIER SYSTEM ─────────────────────────────── */

interface Tier {
    name: string;
    emoji: string;
    min: number;
    max: number;
    style: React.CSSProperties;
    label: string;
}

const TIERS: Tier[] = [
    {
        name: "입문", emoji: "🌱", min: 0, max: 49,
        style: { background: "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)" },
        label: "막 시작한 단계",
    },
    {
        name: "브론즈", emoji: "🥉", min: 50, max: 149,
        style: { background: "linear-gradient(135deg, #b45309 0%, #92400e 100%)" },
        label: "루틴을 만들어가는 중",
    },
    {
        name: "실버", emoji: "🥈", min: 150, max: 299,
        style: { background: "linear-gradient(135deg, #94a3b8 0%, #475569 100%)" },
        label: "꾸준한 관리자",
    },
    {
        name: "골드", emoji: "🥇", min: 300, max: 499,
        style: { background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" },
        label: "고성과 달성자",
    },
    {
        name: "플래티넘", emoji: "💠", min: 500, max: 799,
        style: { background: "linear-gradient(135deg, #14b8a6 0%, #0891b2 100%)" },
        label: "최상위 관리 역량",
    },
    {
        name: "다이아", emoji: "💎", min: 800, max: 1199,
        style: { background: "linear-gradient(135deg, #60a5fa 0%, #4f46e5 100%)" },
        label: "탁월한 일정 마스터",
    },
    {
        name: "마스터", emoji: "🔥", min: 1200, max: Infinity,
        style: { background: "linear-gradient(135deg, #f97316 0%, #ec4899 100%)" },
        label: "루넬의 전설",
    },
];

function getTier(score: number): Tier {
    return [...TIERS].reverse().find((t) => score >= t.min) ?? TIERS[0];
}

function getNextTier(score: number): Tier | null {
    return TIERS.find((t) => t.min > score) ?? null;
}

/* ─────────────────────────────── SCORE FORMULA ─────────────────────────────── */

function computeStreak(schedules: Schedule[]): number {
    const activeDates = new Set(
        schedules
            .filter((s) => s.status !== "CANCELLED")
            .map((s) => s.start_at.slice(0, 10))
    );
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        if (activeDates.has(dateStr)) {
            streak++;
        } else if (i > 0) {
            break;
        }
    }
    return streak;
}

function computeScore(schedules: Schedule[], projects: Project[]): number {
    const completed = schedules.filter((s) => s.status === "COMPLETED");
    const avgImp =
        completed.length > 0
            ? completed.reduce((sum, s) => sum + s.importance_score, 0) / completed.length
            : 0;
    const projectsDone = projects.filter((p) => p.status === "COMPLETED").length;
    const streak = computeStreak(schedules);
    return Math.floor(
        completed.length * 10 +
        Math.max(0, avgImp - 50) * completed.length * 0.15 +
        projectsDone * 25 +
        streak * 4
    );
}

/* ─────────────────────────── CONTRIBUTION HEATMAP ─────────────────────────── */

function ContributionHeatmap({ schedules }: { schedules: Schedule[] }) {
    const activityMap = useMemo(() => {
        const map: Record<string, number> = {};
        schedules.forEach((s) => {
            const d = s.start_at.slice(0, 10);
            map[d] = (map[d] || 0) + 1;
        });
        return map;
    }, [schedules]);

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // Build 52 weeks starting from (today - 363 days)
    const weeks: string[][] = [];
    const cursor = new Date(today);
    cursor.setDate(cursor.getDate() - 363);
    for (let w = 0; w < 52; w++) {
        const week: string[] = [];
        for (let d = 0; d < 7; d++) {
            week.push(cursor.toISOString().slice(0, 10));
            cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(week);
    }

    const maxActivity = Math.max(...Object.values(activityMap), 1);

    // Month labels
    const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
    const monthLabels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, colIdx) => {
        const month = new Date(week[0]).getMonth();
        if (month !== lastMonth) {
            monthLabels.push({ label: monthNames[month], col: colIdx });
            lastMonth = month;
        }
    });

    return (
        <div className="w-full select-none">
            {/* Month labels */}
            <div className="relative h-4 mb-1" style={{ paddingLeft: 28 }}>
                {monthLabels.map(({ label, col }) => (
                    <span
                        key={`${label}-${col}`}
                        className="absolute text-[10px] text-muted-foreground"
                        style={{ left: 28 + col * 13 }}
                    >
                        {label}
                    </span>
                ))}
            </div>
            <div className="flex gap-0.5">
                {/* Day-of-week labels */}
                <div className="flex flex-col gap-0.5 mr-1.5 mt-0.5">
                    {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
                        <span
                            key={day}
                            className={cn(
                                "text-[9px] w-3 text-right text-muted-foreground leading-[10px]",
                                i % 2 === 0 && "opacity-0"
                            )}
                        >
                            {day}
                        </span>
                    ))}
                </div>
                {/* Grid */}
                <div className="flex gap-0.5">
                    {weeks.map((week, wi) => (
                        <div key={wi} className="flex flex-col gap-0.5">
                            {week.map((dayStr) => {
                                const count = activityMap[dayStr] || 0;
                                const isFuture = dayStr > todayStr;
                                const isToday = dayStr === todayStr;
                                const intensity = count === 0 ? 0 : Math.min(4, Math.ceil((count / maxActivity) * 4));
                                return (
                                    <div
                                        key={dayStr}
                                        title={`${dayStr}: ${count}개`}
                                        className={cn(
                                            "w-[10px] h-[10px] rounded-[2px] transition-all cursor-default",
                                            isFuture ? "opacity-0" : "",
                                            isToday ? "ring-1 ring-primary ring-offset-1 ring-offset-background" : "",
                                            intensity === 0 ? "bg-foreground/[0.06]" :
                                                intensity === 1 ? "bg-primary/25" :
                                                    intensity === 2 ? "bg-primary/50" :
                                                        intensity === 3 ? "bg-primary/70" :
                                                            "bg-primary"
                                        )}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-1 mt-2 justify-end">
                <span className="text-[10px] text-muted-foreground mr-1">적음</span>
                {[0, 1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className={cn(
                            "w-[10px] h-[10px] rounded-[2px]",
                            i === 0 ? "bg-foreground/[0.06]" :
                                i === 1 ? "bg-primary/25" :
                                    i === 2 ? "bg-primary/50" :
                                        i === 3 ? "bg-primary/70" :
                                            "bg-primary"
                        )}
                    />
                ))}
                <span className="text-[10px] text-muted-foreground ml-1">많음</span>
            </div>
        </div>
    );
}

/* ─────────────────────────────── ACHIEVEMENTS ─────────────────────────────── */

interface Achievement {
    id: string;
    name: string;
    desc: string;
    emoji: string;
    unlocked: boolean;
    rarity: "common" | "rare" | "epic" | "legendary";
}

const RARITY_STYLE: Record<string, string> = {
    common: "border-border/60 bg-card",
    rare: "border-blue-400/40 bg-blue-500/[0.04] shadow-[0_0_12px_-3px_rgba(96,165,250,0.3)]",
    epic: "border-violet-400/40 bg-violet-500/[0.04] shadow-[0_0_12px_-3px_rgba(167,139,250,0.3)]",
    legendary: "border-amber-400/50 bg-amber-500/[0.05] shadow-[0_0_16px_-3px_rgba(251,191,36,0.4)]",
};

const RARITY_LABEL: Record<string, string> = {
    common: "일반", rare: "희귀", epic: "에픽", legendary: "전설",
};

const RARITY_TEXT: Record<string, string> = {
    common: "text-muted-foreground",
    rare: "text-blue-500",
    epic: "text-violet-500",
    legendary: "text-amber-500",
};

function buildAchievements(schedules: Schedule[], projects: Project[], score: number): Achievement[] {
    const completed = schedules.filter((s) => s.status === "COMPLETED");
    const streak = computeStreak(schedules);
    const avgImp = completed.length > 0
        ? completed.reduce((sum, s) => sum + s.importance_score, 0) / completed.length
        : 0;
    const types = new Set(schedules.map((s) => s.type));
    const maxScore = schedules.reduce((m, s) => Math.max(m, s.importance_score), 0);
    const projectsDone = projects.filter((p) => p.status === "COMPLETED").length;

    return [
        {
            id: "first_schedule", name: "첫 발걸음", emoji: "👣", rarity: "common",
            desc: "첫 번째 일정을 생성했습니다", unlocked: schedules.length >= 1
        },
        {
            id: "first_complete", name: "완료!", emoji: "✅", rarity: "common",
            desc: "일정을 처음으로 완료했습니다", unlocked: completed.length >= 1
        },
        {
            id: "first_project", name: "프로젝트 시작", emoji: "🗂️", rarity: "common",
            desc: "첫 번째 프로젝트를 만들었습니다", unlocked: projects.length >= 1
        },
        {
            id: "ten_done", name: "반복의 힘", emoji: "🔟", rarity: "common",
            desc: "일정 10개를 완료했습니다", unlocked: completed.length >= 10
        },
        {
            id: "streak_7", name: "7일 연속", emoji: "🔥", rarity: "rare",
            desc: "7일 연속으로 활동했습니다", unlocked: streak >= 7
        },
        {
            id: "tri_type", name: "팔방미인", emoji: "🌈", rarity: "rare",
            desc: "세 가지 유형의 일정을 모두 사용", unlocked: types.size >= 3
        },
        {
            id: "high_importance", name: "중요한 사람", emoji: "⚡", rarity: "rare",
            desc: "완료 일정 평균 중요도 80점 이상", unlocked: avgImp >= 80
        },
        {
            id: "thirty_done", name: "루틴 마스터", emoji: "🏅", rarity: "rare",
            desc: "일정 30개를 완료했습니다", unlocked: completed.length >= 30
        },
        {
            id: "project_done", name: "프로젝트 완주", emoji: "🎯", rarity: "rare",
            desc: "프로젝트를 완료했습니다", unlocked: projectsDone >= 1
        },
        {
            id: "super_score", name: "초고중요", emoji: "🌟", rarity: "epic",
            desc: "중요도 140점 이상의 일정 달성", unlocked: maxScore >= 140
        },
        {
            id: "hundred_done", name: "백 번의 노력", emoji: "💯", rarity: "epic",
            desc: "일정 100개를 완료했습니다", unlocked: completed.length >= 100
        },
        {
            id: "streak_30", name: "한 달 연속", emoji: "📅", rarity: "epic",
            desc: "30일 연속으로 활동했습니다", unlocked: streak >= 30
        },
        {
            id: "three_projects", name: "시리얼 프로젝터", emoji: "🚀", rarity: "epic",
            desc: "프로젝트 3개를 완료했습니다", unlocked: projectsDone >= 3
        },
        {
            id: "legendary_score", name: "루넬의 전설", emoji: "👑", rarity: "legendary",
            desc: "루넬 점수 1000점 이상 달성", unlocked: score >= 1000
        },
    ];
}

/* ─────────────────────────────── MAIN PAGE ─────────────────────────────── */

export default function ProfilePage() {
    const { user } = useAuth();
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get<Schedule[]>("/schedules"),
            api.get<Project[]>("/projects"),
        ])
            .then(([sRes, pRes]) => {
                setSchedules(sRes.data);
                setProjects(pRes.data);
            })
            .catch(() => toast.error("프로필 데이터를 불러올 수 없습니다."))
            .finally(() => setLoading(false));
    }, []);

    const score = useMemo(() => computeScore(schedules, projects), [schedules, projects]);
    const tier = getTier(score);
    const nextTier = getNextTier(score);
    const streak = useMemo(() => computeStreak(schedules), [schedules]);
    const completed = schedules.filter((s) => s.status === "COMPLETED");
    const avgImp = completed.length > 0
        ? Math.round(completed.reduce((sum, s) => sum + s.importance_score, 0) / completed.length)
        : 0;
    const achievements = useMemo(() => buildAchievements(schedules, projects, score), [schedules, projects, score]);
    const unlockedCount = achievements.filter((a) => a.unlocked).length;
    const progressToNext = nextTier
        ? Math.min(100, Math.round(((score - tier.min) / (nextTier.min - tier.min)) * 100))
        : 100;

    const typeCount: Record<string, number> = {};
    schedules.forEach((s) => { typeCount[s.type] = (typeCount[s.type] || 0) + 1; });

    if (loading) {
        return (
            <div className="flex justify-center py-24">
                <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl space-y-6">

            {/* ── TIER HERO CARD ── */}
            <div
                className="relative rounded-2xl overflow-hidden p-6 text-white"
                style={tier.style}
            >
                {/* Background decoration */}
                <div
                    className="pointer-events-none absolute top-2 right-6 text-[7rem] opacity-10 select-none"
                    aria-hidden
                >
                    {tier.emoji}
                </div>

                <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
                    {/* Avatar + name */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold ring-2 ring-white/30 shrink-0">
                            {user?.name?.[0] ?? "?"}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <h1 className="text-lg font-bold truncate">{user?.name}</h1>
                                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                                    {user?.role}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{tier.emoji}</span>
                                <div>
                                    <span className="font-bold text-base">{tier.name}</span>
                                    <span className="text-white/70 text-xs ml-2">{tier.label}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Score */}
                    <div className="text-left sm:text-right">
                        <div className="text-4xl font-black tabular-nums">{score.toLocaleString()}</div>
                        <div className="text-white/70 text-xs">루넬 점수</div>
                    </div>
                </div>

                {/* Progress bar */}
                {nextTier ? (
                    <div className="relative mt-5">
                        <div className="flex items-center justify-between text-[11px] text-white/70 mb-1.5">
                            <span>{tier.name} {tier.emoji}</span>
                            <span>
                                {nextTier.emoji} {nextTier.name}까지{" "}
                                <span className="text-white font-semibold">{(nextTier.min - score).toLocaleString()}점</span> 남음
                            </span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden">
                            <div
                                className="bg-white rounded-full h-2.5 transition-all duration-700 ease-out"
                                style={{ width: `${progressToNext}%` }}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="mt-5 text-center text-white/80 text-sm font-medium">
                        🎉 최고 등급 달성! — 루넬의 전설
                    </div>
                )}
            </div>

            {/* ── STAT CHIPS ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { icon: CheckCircle2, label: "완료한 일정", value: completed.length, color: "text-emerald-500" },
                    { icon: Flame, label: "현재 연속 활동", value: `${streak}일`, color: "text-orange-500" },
                    { icon: Star, label: "완료 평균 중요도", value: avgImp > 0 ? `${avgImp}점` : "—", color: "text-amber-500" },
                    { icon: Target, label: "완료한 프로젝트", value: projects.filter((p) => p.status === "COMPLETED").length, color: "text-blue-500" },
                ].map(({ icon: Icon, label, value, color }) => (
                    <Card key={label}>
                        <CardContent className="pt-4 pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <Icon className={cn("h-3.5 w-3.5", color)} />
                                <span className="text-[11px] text-muted-foreground">{label}</span>
                            </div>
                            <div className="text-2xl font-bold">{value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* ── CONTRIBUTION HEATMAP ── */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">활동 현황 — 최근 1년</CardTitle>
                        <span className="text-[11px] text-muted-foreground">
                            일정 {schedules.length}개
                        </span>
                    </div>
                </CardHeader>
                <CardContent className="overflow-x-auto pb-4">
                    <ContributionHeatmap schedules={schedules} />
                </CardContent>
            </Card>

            {/* ── TYPE BREAKDOWN + SCORE BREAKDOWN ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">일정 유형 분포</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {schedules.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-6 gap-3">
                                <p className="text-xs text-muted-foreground">아직 일정이 없습니다.</p>
                                <Button asChild variant="outline" size="sm">
                                    <Link href="/dashboard/schedules/new">
                                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                                        첫 일정 만들기
                                    </Link>
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {[
                                    { type: "PROJECT", label: "프로젝트", color: "bg-blue-500", icon: BookOpen },
                                    { type: "INTERVAL", label: "인터벌", color: "bg-violet-500", icon: Calendar },
                                    { type: "EVENT", label: "이벤트", color: "bg-emerald-500", icon: Users },
                                ].map(({ type, label, color, icon: Icon }) => {
                                    const count = typeCount[type] || 0;
                                    const pct = (count / schedules.length) * 100;
                                    return (
                                        <div key={type}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className="text-xs">{label}</span>
                                                </div>
                                                <span className="text-xs font-medium tabular-nums">
                                                    {count}개 ({Math.round(pct)}%)
                                                </span>
                                            </div>
                                            <div className="w-full bg-foreground/[0.05] rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className={cn("rounded-full h-1.5 transition-all duration-700", color)}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">루넬 점수 계산</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2.5 text-xs">
                            {[
                                {
                                    label: "완료한 일정 × 10",
                                    value: completed.length * 10,
                                    note: `${completed.length}개`,
                                },
                                {
                                    label: "높은 중요도 보너스",
                                    value: Math.floor(Math.max(0, avgImp - 50) * completed.length * 0.15),
                                    note: avgImp > 50 ? `평균 ${avgImp}점` : "없음",
                                },
                                {
                                    label: "완료한 프로젝트 × 25",
                                    value: projects.filter((p) => p.status === "COMPLETED").length * 25,
                                    note: `${projects.filter((p) => p.status === "COMPLETED").length}개`,
                                },
                                {
                                    label: "연속 활동 × 4",
                                    value: streak * 4,
                                    note: `${streak}일`,
                                },
                            ].map(({ label, value, note }) => (
                                <div key={label} className="flex items-center justify-between">
                                    <div>
                                        <span className="text-muted-foreground">{label}</span>
                                        <span className="text-muted-foreground/60 ml-1.5">({note})</span>
                                    </div>
                                    <span className="font-medium tabular-nums">+{value}</span>
                                </div>
                            ))}
                            <div className="border-t border-border/50 pt-2 flex items-center justify-between font-bold">
                                <span>합계</span>
                                <span className="text-primary tabular-nums">{score.toLocaleString()}점</span>
                            </div>
                            {nextTier && (
                                <div className="mt-1 rounded-lg bg-primary/[0.05] border border-primary/10 p-2.5 text-center leading-snug">
                                    <span className="text-primary font-medium">
                                        {nextTier.emoji} {nextTier.name}까지{" "}
                                        <span className="font-bold">{(nextTier.min - score).toLocaleString()}점</span>
                                    </span>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                        일정 완료로 먼저 달성해 보세요!
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── ACHIEVEMENTS ── */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">업적</CardTitle>
                        <span className="text-[11px] text-muted-foreground">
                            {unlockedCount} / {achievements.length} 달성
                        </span>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {achievements
                            .sort((a, b) => Number(b.unlocked) - Number(a.unlocked))
                            .map((ach) => (
                                <div
                                    key={ach.id}
                                    className={cn(
                                        "rounded-xl border p-3 text-center transition-all",
                                        ach.unlocked
                                            ? RARITY_STYLE[ach.rarity]
                                            : "border-border/30 bg-foreground/[0.01] opacity-40 grayscale"
                                    )}
                                >
                                    <div className="text-2xl mb-1 relative inline-block">
                                        {ach.emoji}
                                        {!ach.unlocked && (
                                            <Lock className="absolute -bottom-0.5 -right-1.5 h-3 w-3 text-muted-foreground bg-background rounded-full p-px" />
                                        )}
                                    </div>
                                    <div className="text-[11px] font-semibold leading-tight">{ach.name}</div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                                        {ach.desc}
                                    </div>
                                    <div
                                        className={cn(
                                            "text-[9px] mt-1.5 font-bold uppercase tracking-wide",
                                            RARITY_TEXT[ach.rarity]
                                        )}
                                    >
                                        {RARITY_LABEL[ach.rarity]}
                                    </div>
                                </div>
                            ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
