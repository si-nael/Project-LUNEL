"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { engineFetch, enginePatch } from "@/lib/engine-api";
import type { EngineProblem, ProblemKind } from "@/types/engine";

export default function ProblemDetailPage({
    params,
}: {
    params: { id: string };
}) {
    const [problem, setProblem] = useState<EngineProblem | null>(null);
    const [title, setTitle] = useState("");
    const [statement, setStatement] = useState("");
    const [kind, setKind] = useState<ProblemKind>("ANSWER");
    const [checker, setChecker] = useState("TOKENS");
    const [points, setPoints] = useState("100");
    const [expectedAnswer, setExpectedAnswer] = useState("");
    const [status, setStatus] = useState<"DRAFT" | "READY">("DRAFT");
    const [saving, setSaving] = useState(false);

    const load = async () => {
        try {
            const data = await engineFetch<EngineProblem>(`v1/problems/${params.id}`);
            setProblem(data);
            setTitle(data.title);
            setStatement(data.statement);
            setKind(data.kind);
            setChecker(data.checker);
            setPoints(String(data.default_points));
            setExpectedAnswer(data.expected_answer || "");
            setStatus(data.status);
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : "문제를 불러오지 못했습니다.");
        }
    };

    useEffect(() => {
        void load();
    }, [params.id]);

    const save = async () => {
        setSaving(true);
        try {
            const updated = await enginePatch<EngineProblem>(
                `v1/problems/${params.id}`,
                {
                    title,
                    statement,
                    kind,
                    checker,
                    default_points: Number(points),
                    expected_answer: kind === "ANSWER" ? expectedAnswer || null : null,
                    status,
                }
            );
            setProblem(updated);
            toast.success("문제를 저장했습니다.");
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : "문제를 저장하지 못했습니다.");
        } finally {
            setSaving(false);
        }
    };

    if (!problem) {
        return (
            <p className="py-20 text-center text-sm text-muted-foreground">
                문제를 불러오는 중입니다.
            </p>
        );
    }

    return (
        <div className="space-y-6">
            <header className="border-b pb-6">
                <Button asChild variant="ghost" size="sm" className="-ml-3 mb-3">
                    <Link href="/dashboard/problems">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        문제 목록
                    </Link>
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {problem.title}
                    </h1>
                    <Badge variant={status === "READY" ? "default" : "secondary"}>
                        {status}
                    </Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {problem.slug} · {problem.id}
                </p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">문제 원본</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="title">제목</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="statement">문제 설명</Label>
                        <textarea
                            id="statement"
                            className="min-h-48 w-full rounded-md border bg-background px-3 py-2 text-sm"
                            value={statement}
                            onChange={(event) => setStatement(event.target.value)}
                        />
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                            <Label>종류</Label>
                            <select
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
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
                        <div className="space-y-2">
                            <Label>체커</Label>
                            <select
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                value={checker}
                                onChange={(event) => setChecker(event.target.value)}
                                disabled={kind !== "ANSWER"}
                            >
                                <option value="EXACT">EXACT</option>
                                <option value="TOKENS">TOKENS</option>
                                <option value="FLOAT">FLOAT</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>기본 점수</Label>
                            <Input
                                type="number"
                                value={points}
                                onChange={(event) => setPoints(event.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>상태</Label>
                            <select
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                value={status}
                                onChange={(event) =>
                                    setStatus(event.target.value as "DRAFT" | "READY")
                                }
                            >
                                <option value="DRAFT">DRAFT</option>
                                <option value="READY">READY</option>
                            </select>
                        </div>
                    </div>
                    {kind === "ANSWER" && (
                        <div className="space-y-2">
                            <Label htmlFor="answer">기준 정답</Label>
                            <textarea
                                id="answer"
                                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
                                value={expectedAnswer}
                                onChange={(event) =>
                                    setExpectedAnswer(event.target.value)
                                }
                            />
                        </div>
                    )}
                    <div className="flex justify-end">
                        <Button disabled={saving} onClick={save}>
                            {saving ? "저장 중" : "변경 저장"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
