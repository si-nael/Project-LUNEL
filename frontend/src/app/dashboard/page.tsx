"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
    ArrowRight,
    CircleCheck,
    CircleX,
    Database,
    FileCode2,
    Radio,
    Server,
    Trophy,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { engineFetch } from "@/lib/engine-api";
import type {
    EngineHealth,
    EngineProblem,
    EngineRuntime,
    RuntimeState,
} from "@/types/engine";

const STATE_LABEL: Record<RuntimeState, string> = {
    DRAFT: "초안",
    REGISTRATION: "등록 중",
    RUNNING: "진행 중",
    FROZEN: "스코어보드 동결",
    FINISHED: "종료",
    CANCELLED: "취소",
};

export default function EngineDashboardPage() {
    const [health, setHealth] = useState<EngineHealth | null>(null);
    const [problems, setProblems] = useState<EngineProblem[]>([]);
    const [runtimes, setRuntimes] = useState<EngineRuntime[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const [nextHealth, nextProblems, nextRuntimes] = await Promise.all([
                engineFetch<EngineHealth>("health"),
                engineFetch<EngineProblem[]>("v1/problems"),
                engineFetch<EngineRuntime[]>("v1/runtimes"),
            ]);
            setHealth(nextHealth);
            setProblems(nextProblems);
            setRuntimes(nextRuntimes);
            setError(null);
        } catch (caught) {
            setHealth(null);
            setError(
                caught instanceof Error
                    ? caught.message
                    : "로컬 엔진에 연결할 수 없습니다."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const active = useMemo(
        () =>
            runtimes.filter((runtime) =>
                ["REGISTRATION", "RUNNING", "FROZEN"].includes(runtime.state)
            ),
        [runtimes]
    );
    const submissions = runtimes.reduce(
        (sum, runtime) => sum + runtime.submission_count,
        0
    );

    return (
        <div className="space-y-7">
            <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Server className="h-4 w-4" />
                        LOCAL DAEMON
                    </div>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                        LUNEL Engine
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        대회 상태, 문제, 제출, 채점과 스코어보드의 기준 상태를
                        보관하는 로컬 엔진입니다. 이 웹은 엔진을 조작하는 콘솔입니다.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void load()}>
                    연결 새로고침
                </Button>
            </header>

            <Card
                className={
                    health
                        ? "border-emerald-500/30"
                        : error
                          ? "border-destructive/40"
                          : ""
                }
            >
                <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center">
                    {health ? (
                        <CircleCheck className="h-5 w-5 text-emerald-600" />
                    ) : (
                        <CircleX className="h-5 w-5 text-destructive" />
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                            {loading
                                ? "엔진 연결 확인 중"
                                : health
                                  ? `Engine ${health.version} 연결됨`
                                  : "엔진 연결 끊김"}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                            {health?.database || error || "127.0.0.1:8100"}
                        </p>
                    </div>
                    <Badge variant={health ? "default" : "destructive"}>
                        {health ? "ONLINE" : "OFFLINE"}
                    </Badge>
                </CardContent>
            </Card>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    {
                        label: "등록 문제",
                        value: problems.length,
                        icon: FileCode2,
                    },
                    {
                        label: "전체 대회",
                        value: runtimes.length,
                        icon: Trophy,
                    },
                    {
                        label: "활성 런타임",
                        value: active.length,
                        icon: Radio,
                    },
                    {
                        label: "누적 제출",
                        value: submissions,
                        icon: Database,
                    },
                ].map((metric) => {
                    const Icon = metric.icon;
                    return (
                        <Card key={metric.label}>
                            <CardContent className="pt-5">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <p className="mt-5 text-2xl font-semibold">
                                    {metric.value}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {metric.label}
                                </p>
                            </CardContent>
                        </Card>
                    );
                })}
            </section>

            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-sm">최근 대회 런타임</CardTitle>
                    <Button asChild size="sm" variant="ghost">
                        <Link href="/dashboard/competitions">
                            전체 보기
                            <ArrowRight className="ml-2 h-3.5 w-3.5" />
                        </Link>
                    </Button>
                </CardHeader>
                <CardContent>
                    {runtimes.length === 0 ? (
                        <div className="py-12 text-center">
                            <p className="text-sm text-muted-foreground">
                                아직 생성된 대회가 없습니다.
                            </p>
                            <Button asChild className="mt-4" size="sm">
                                <Link href="/dashboard/competitions">
                                    첫 대회 만들기
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {runtimes.slice(0, 6).map((runtime) => (
                                <Link
                                    key={runtime.id}
                                    href={`/dashboard/competitions/${runtime.id}`}
                                    className="grid grid-cols-[1fr_auto] gap-4 py-3 first:pt-0 last:pb-0"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">
                                            {runtime.title}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {runtime.mode} · 문제 {runtime.problems.length} ·
                                            참가자 {runtime.participant_count} · 제출{" "}
                                            {runtime.submission_count}
                                        </p>
                                    </div>
                                    <Badge
                                        variant={
                                            runtime.state === "RUNNING"
                                                ? "default"
                                                : "secondary"
                                        }
                                    >
                                        {STATE_LABEL[runtime.state]}
                                    </Badge>
                                </Link>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
