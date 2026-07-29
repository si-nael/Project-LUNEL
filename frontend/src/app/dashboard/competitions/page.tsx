"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Radio, Trophy } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { engineFetch, enginePost } from "@/lib/engine-api";
import type {
    EngineProblem,
    EngineRuntime,
    RuntimeMode,
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

export default function CompetitionsPage() {
    const [runtimes, setRuntimes] = useState<EngineRuntime[]>([]);
    const [problems, setProblems] = useState<EngineProblem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [title, setTitle] = useState("");
    const [mode, setMode] = useState<RuntimeMode>("IOI");
    const [selected, setSelected] = useState<string[]>([]);
    const [creating, setCreating] = useState(false);

    const load = async () => {
        try {
            const [nextRuntimes, nextProblems] = await Promise.all([
                engineFetch<EngineRuntime[]>("v1/runtimes"),
                engineFetch<EngineProblem[]>("v1/problems"),
            ]);
            setRuntimes(nextRuntimes);
            setProblems(nextProblems);
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : "대회를 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const readyProblems = problems.filter((problem) => problem.status === "READY");

    const toggleProblem = (id: string) => {
        setSelected((current) =>
            current.includes(id)
                ? current.filter((value) => value !== id)
                : [...current, id]
        );
    };

    const createRuntime = async () => {
        if (!title.trim() || selected.length === 0) {
            toast.error("대회 이름과 한 개 이상의 READY 문제를 선택하세요.");
            return;
        }
        setCreating(true);
        try {
            const runtime = await enginePost<EngineRuntime>("v1/runtimes", {
                title: title.trim(),
                mode,
                wrong_penalty_minutes: 20,
                problems: selected.map((problemId, index) => ({
                    problem_id: problemId,
                    label: String.fromCharCode(65 + index),
                })),
            });
            setTitle("");
            setMode("IOI");
            setSelected([]);
            setShowCreate(false);
            await load();
            toast.success(`${runtime.title} 런타임을 생성했습니다.`);
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : "대회를 만들지 못했습니다.");
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Radio className="h-4 w-4" />
                        ENGINE RUNTIMES
                    </div>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                        대회
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        엔진에 대회 런타임을 만들고 개시, 동결, 종료까지 상태를 전이합니다.
                    </p>
                </div>
                <Button onClick={() => setShowCreate((value) => !value)}>
                    <Plus className="mr-2 h-4 w-4" />
                    대회 열기
                </Button>
            </header>

            {showCreate && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">새 대회 런타임</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                            <div className="space-y-2">
                                <Label htmlFor="runtime-title">대회 이름</Label>
                                <Input
                                    id="runtime-title"
                                    value={title}
                                    onChange={(event) => setTitle(event.target.value)}
                                    placeholder="2026 교내 알고리즘 챌린지"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="runtime-mode">스코어 방식</Label>
                                <select
                                    id="runtime-mode"
                                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                    value={mode}
                                    onChange={(event) =>
                                        setMode(event.target.value as RuntimeMode)
                                    }
                                >
                                    <option value="IOI">IOI 점수제</option>
                                    <option value="ICPC">ICPC 해결/페널티</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <Label>문제 구성</Label>
                            {readyProblems.length === 0 ? (
                                <p className="mt-2 rounded-md border p-4 text-sm text-muted-foreground">
                                    READY 문제가 없습니다. 먼저 문제 메뉴에서 문제를 준비하세요.
                                </p>
                            ) : (
                                <div className="mt-2 divide-y rounded-md border">
                                    {readyProblems.map((problem) => {
                                        const index = selected.indexOf(problem.id);
                                        return (
                                            <label
                                                key={problem.id}
                                                className="flex cursor-pointer items-center gap-3 p-3 hover:bg-muted/50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={index >= 0}
                                                    onChange={() =>
                                                        toggleProblem(problem.id)
                                                    }
                                                />
                                                <span className="w-6 font-mono text-xs text-muted-foreground">
                                                    {index >= 0
                                                        ? String.fromCharCode(65 + index)
                                                        : "—"}
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-sm">
                                                    {problem.title}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {problem.default_points}점
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <Button disabled={creating} onClick={createRuntime}>
                                {creating ? "생성 중" : "런타임 생성"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {loading ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                    대회 런타임을 불러오는 중입니다.
                </p>
            ) : runtimes.length === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <Trophy className="mx-auto h-8 w-8 text-muted-foreground" />
                        <p className="mt-3 text-sm text-muted-foreground">
                            아직 생성된 대회가 없습니다.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {runtimes.map((runtime) => (
                        <Link
                            key={runtime.id}
                            href={`/dashboard/competitions/${runtime.id}`}
                        >
                            <Card className="h-full transition-colors hover:border-primary/40">
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-4">
                                        <CardTitle className="text-base">
                                            {runtime.title}
                                        </CardTitle>
                                        <Badge
                                            variant={
                                                runtime.state === "RUNNING"
                                                    ? "default"
                                                    : "secondary"
                                            }
                                        >
                                            {STATE_LABEL[runtime.state]}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-4 gap-3 text-center">
                                        <div>
                                            <p className="text-lg font-semibold">
                                                {runtime.mode}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                방식
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-lg font-semibold">
                                                {runtime.problems.length}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                문제
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-lg font-semibold">
                                                {runtime.participant_count}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                참가자
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-lg font-semibold">
                                                {runtime.submission_count}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                제출
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
