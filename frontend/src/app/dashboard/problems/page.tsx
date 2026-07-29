"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileCode2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { engineFetch, enginePost } from "@/lib/engine-api";
import type { EngineProblem, ProblemKind } from "@/types/engine";

const KIND_LABEL: Record<ProblemKind, string> = {
    ANSWER: "정답형",
    CODE: "코드",
    MANUAL: "운영자 채점",
};

export default function ProblemsPage() {
    const [problems, setProblems] = useState<EngineProblem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [query, setQuery] = useState("");
    const [creating, setCreating] = useState(false);
    const [slug, setSlug] = useState("");
    const [title, setTitle] = useState("");
    const [statement, setStatement] = useState("");
    const [kind, setKind] = useState<ProblemKind>("ANSWER");
    const [expectedAnswer, setExpectedAnswer] = useState("");

    const load = async () => {
        try {
            setProblems(await engineFetch<EngineProblem[]>("v1/problems"));
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : "문제를 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const visible = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return problems;
        return problems.filter(
            (problem) =>
                problem.title.toLowerCase().includes(normalized) ||
                problem.slug.toLowerCase().includes(normalized)
        );
    }, [problems, query]);

    const createProblem = async () => {
        if (!slug || !title) {
            toast.error("식별자와 제목을 입력하세요.");
            return;
        }
        setCreating(true);
        try {
            await enginePost<EngineProblem>("v1/problems", {
                slug,
                title,
                statement,
                kind,
                checker: "TOKENS",
                default_points: 100,
                expected_answer: kind === "ANSWER" ? expectedAnswer || null : null,
                status: kind === "ANSWER" && expectedAnswer ? "READY" : "DRAFT",
            });
            setSlug("");
            setTitle("");
            setStatement("");
            setExpectedAnswer("");
            setKind("ANSWER");
            setShowCreate(false);
            await load();
            toast.success("엔진 문제 저장소에 등록했습니다.");
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : "문제를 만들지 못했습니다.");
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <FileCode2 className="h-4 w-4" />
                        ENGINE PROBLEM STORE
                    </div>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                        문제
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        대회와 분리된 문제 원본을 만들고, 준비된 문제를 여러 대회에 연결합니다.
                    </p>
                </div>
                <Button onClick={() => setShowCreate((value) => !value)}>
                    <Plus className="mr-2 h-4 w-4" />
                    문제 만들기
                </Button>
            </header>

            {showCreate && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">새 문제</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="slug">식별자</Label>
                                <Input
                                    id="slug"
                                    value={slug}
                                    placeholder="lunar-path"
                                    onChange={(event) =>
                                        setSlug(
                                            event.target.value
                                                .toLowerCase()
                                                .replace(/[^a-z0-9-]/g, "-")
                                        )
                                    }
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="title">제목</Label>
                                <Input
                                    id="title"
                                    value={title}
                                    onChange={(event) => setTitle(event.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="statement">문제 설명</Label>
                            <textarea
                                id="statement"
                                className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
                                value={statement}
                                onChange={(event) => setStatement(event.target.value)}
                            />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="kind">채점 방식</Label>
                                <select
                                    id="kind"
                                    className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                                    value={kind}
                                    onChange={(event) =>
                                        setKind(event.target.value as ProblemKind)
                                    }
                                >
                                    <option value="ANSWER">정답 비교</option>
                                    <option value="CODE">외부 샌드박스</option>
                                    <option value="MANUAL">운영자 채점</option>
                                </select>
                            </div>
                            {kind === "ANSWER" && (
                                <div className="space-y-2">
                                    <Label htmlFor="answer">기준 정답</Label>
                                    <Input
                                        id="answer"
                                        value={expectedAnswer}
                                        onChange={(event) =>
                                            setExpectedAnswer(event.target.value)
                                        }
                                        placeholder="입력하면 즉시 READY"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end">
                            <Button disabled={creating} onClick={createProblem}>
                                {creating ? "저장 중" : "엔진에 저장"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    className="pl-9"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="제목 또는 식별자 검색"
                />
            </div>

            {loading ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                    문제 저장소를 불러오는 중입니다.
                </p>
            ) : visible.length === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center text-sm text-muted-foreground">
                        등록된 문제가 없습니다.
                    </CardContent>
                </Card>
            ) : (
                <div className="divide-y rounded-md border bg-card">
                    {visible.map((problem) => (
                        <Link
                            key={problem.id}
                            href={`/dashboard/problems/${problem.id}`}
                            className="grid gap-3 p-4 transition-colors hover:bg-muted/50 sm:grid-cols-[1fr_auto] sm:items-center"
                        >
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs text-muted-foreground">
                                        {problem.slug}
                                    </span>
                                    <Badge
                                        variant={
                                            problem.status === "READY"
                                                ? "default"
                                                : "secondary"
                                        }
                                    >
                                        {problem.status}
                                    </Badge>
                                </div>
                                <p className="mt-1 truncate text-sm font-medium">
                                    {problem.title}
                                </p>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {KIND_LABEL[problem.kind]} · {problem.default_points}점
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
