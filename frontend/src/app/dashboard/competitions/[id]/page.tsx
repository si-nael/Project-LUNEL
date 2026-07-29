"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Lock, Radio, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { engineFetch, enginePatch, enginePost } from "@/lib/engine-api";
import type {
    EngineParticipant,
    EngineRuntime,
    EngineScoreboard,
    EngineSubmission,
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

const COMMANDS: Record<
    RuntimeState,
    { value: string; label: string; destructive?: boolean }[]
> = {
    DRAFT: [
        { value: "OPEN_REGISTRATION", label: "참가 등록 열기" },
        { value: "CANCEL", label: "취소", destructive: true },
    ],
    REGISTRATION: [
        { value: "START", label: "대회 시작" },
        { value: "RESET", label: "초안으로" },
        { value: "CANCEL", label: "취소", destructive: true },
    ],
    RUNNING: [
        { value: "FREEZE", label: "스코어보드 동결" },
        { value: "FINISH", label: "대회 종료" },
        { value: "CANCEL", label: "취소", destructive: true },
    ],
    FROZEN: [
        { value: "UNFREEZE", label: "동결 해제" },
        { value: "FINISH", label: "대회 종료" },
        { value: "CANCEL", label: "취소", destructive: true },
    ],
    FINISHED: [{ value: "RESET", label: "초안으로 재설정" }],
    CANCELLED: [{ value: "RESET", label: "초안으로 재설정" }],
};

export default function CompetitionDetailPage({
    params,
}: {
    params: { id: string };
}) {
    const [runtime, setRuntime] = useState<EngineRuntime | null>(null);
    const [participants, setParticipants] = useState<EngineParticipant[]>([]);
    const [submissions, setSubmissions] = useState<EngineSubmission[]>([]);
    const [scoreboard, setScoreboard] = useState<EngineScoreboard | null>(null);
    const [participantName, setParticipantName] = useState("");
    const [selectedParticipant, setSelectedParticipant] = useState("");
    const [selectedProblem, setSelectedProblem] = useState("");
    const [payload, setPayload] = useState("");
    const [busy, setBusy] = useState(false);

    const load = async () => {
        try {
            const [nextRuntime, nextParticipants, nextSubmissions, nextScoreboard] =
                await Promise.all([
                    engineFetch<EngineRuntime>(`v1/runtimes/${params.id}`),
                    engineFetch<EngineParticipant[]>(
                        `v1/runtimes/${params.id}/participants`
                    ),
                    engineFetch<EngineSubmission[]>(
                        `v1/runtimes/${params.id}/submissions`
                    ),
                    engineFetch<EngineScoreboard>(
                        `v1/runtimes/${params.id}/scoreboard?include_frozen=true`
                    ),
                ]);
            setRuntime(nextRuntime);
            setParticipants(nextParticipants);
            setSubmissions(nextSubmissions);
            setScoreboard(nextScoreboard);
            setSelectedParticipant((value) => value || nextParticipants[0]?.id || "");
            setSelectedProblem((value) => value || nextRuntime.problems[0]?.id || "");
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : "대회를 불러오지 못했습니다.");
        }
    };

    useEffect(() => {
        void load();
    }, [params.id]);

    const problemMap = useMemo(
        () => new Map(runtime?.problems.map((problem) => [problem.id, problem])),
        [runtime]
    );
    const participantMap = useMemo(
        () => new Map(participants.map((participant) => [participant.id, participant])),
        [participants]
    );
    const activeProblem = problemMap.get(selectedProblem);

    const runCommand = async (command: string) => {
        setBusy(true);
        try {
            await enginePost(`v1/runtimes/${params.id}/commands`, { command });
            await load();
            toast.success("엔진 상태를 변경했습니다.");
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : "상태를 변경하지 못했습니다.");
        } finally {
            setBusy(false);
        }
    };

    const addParticipant = async () => {
        if (!participantName.trim()) return;
        setBusy(true);
        try {
            await enginePost(`v1/runtimes/${params.id}/participants`, {
                name: participantName.trim(),
            });
            setParticipantName("");
            await load();
            toast.success("참가자를 등록했습니다.");
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : "참가자를 등록하지 못했습니다.");
        } finally {
            setBusy(false);
        }
    };

    const submit = async () => {
        if (!selectedParticipant || !selectedProblem) {
            toast.error("참가자와 문제를 선택하세요.");
            return;
        }
        setBusy(true);
        try {
            await enginePost(`v1/runtimes/${params.id}/submissions`, {
                participant_id: selectedParticipant,
                runtime_problem_id: selectedProblem,
                answer: activeProblem?.kind === "ANSWER" ? payload : null,
                source_code: activeProblem?.kind === "CODE" ? payload : null,
                language: activeProblem?.kind === "CODE" ? "text" : null,
            });
            setPayload("");
            await load();
            toast.success("제출을 엔진에 기록했습니다.");
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : "제출하지 못했습니다.");
        } finally {
            setBusy(false);
        }
    };

    const judge = async (
        submission: EngineSubmission,
        verdict: "ACCEPTED" | "WRONG_ANSWER"
    ) => {
        const maxScore =
            problemMap.get(submission.runtime_problem_id)?.points || 100;
        setBusy(true);
        try {
            await enginePatch(
                `v1/runtimes/${params.id}/submissions/${submission.id}`,
                {
                    verdict,
                    score: verdict === "ACCEPTED" ? maxScore : 0,
                    penalty: 0,
                    message: "Operator decision from LUNEL Web",
                }
            );
            await load();
            toast.success("채점 결과를 반영했습니다.");
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : "채점하지 못했습니다.");
        } finally {
            setBusy(false);
        }
    };

    if (!runtime) {
        return (
            <p className="py-20 text-center text-sm text-muted-foreground">
                대회 런타임을 불러오는 중입니다.
            </p>
        );
    }

    const canRegister = ["REGISTRATION", "RUNNING", "FROZEN"].includes(
        runtime.state
    );
    const canSubmit = ["RUNNING", "FROZEN"].includes(runtime.state);

    return (
        <div className="space-y-6">
            <header className="border-b pb-6">
                <Button asChild variant="ghost" size="sm" className="-ml-3 mb-3">
                    <Link href="/dashboard/competitions">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        대회 목록
                    </Link>
                </Button>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-semibold tracking-tight">
                                {runtime.title}
                            </h1>
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
                        <p className="mt-2 text-xs text-muted-foreground">
                            {runtime.mode} · 문제 {runtime.problems.length} · 참가자{" "}
                            {participants.length} · 제출 {submissions.length}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {COMMANDS[runtime.state].map((command) => (
                            <Button
                                key={command.value}
                                size="sm"
                                variant={command.destructive ? "destructive" : "outline"}
                                disabled={busy}
                                onClick={() => void runCommand(command.value)}
                            >
                                {command.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </header>

            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-sm">운영자 스코어보드</CardTitle>
                    {runtime.state === "FROZEN" && (
                        <Badge variant="secondary">
                            <Lock className="mr-1 h-3 w-3" />
                            공개판 동결 중
                        </Badge>
                    )}
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    {!scoreboard || scoreboard.rankings.length === 0 ? (
                        <p className="py-10 text-center text-sm text-muted-foreground">
                            아직 순위 데이터가 없습니다.
                        </p>
                    ) : (
                        <table className="w-full min-w-[640px] text-sm">
                            <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground">
                                    <th className="pb-3 font-medium">순위</th>
                                    <th className="pb-3 font-medium">참가자</th>
                                    {scoreboard.problems.map((problem) => (
                                        <th
                                            key={problem.id}
                                            className="pb-3 text-center font-medium"
                                        >
                                            {problem.label}
                                        </th>
                                    ))}
                                    <th className="pb-3 text-right font-medium">
                                        {runtime.mode === "ICPC" ? "해결" : "점수"}
                                    </th>
                                    {runtime.mode === "ICPC" && (
                                        <th className="pb-3 text-right font-medium">
                                            페널티
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {scoreboard.rankings.map((row) => (
                                    <tr key={row.participant_id} className="border-b last:border-0">
                                        <td className="py-3 font-mono">{row.rank}</td>
                                        <td className="py-3 font-medium">{row.name}</td>
                                        {scoreboard.problems.map((problem) => {
                                            const cell = row.problems[problem.label];
                                            return (
                                                <td
                                                    key={problem.id}
                                                    className="py-3 text-center font-mono text-xs"
                                                >
                                                    {runtime.mode === "ICPC"
                                                        ? cell?.solved
                                                            ? `+${Math.max(0, (cell.attempts || 1) - 1)}`
                                                            : cell?.attempts
                                                              ? `-${cell.attempts}`
                                                              : "—"
                                                        : cell?.score ?? 0}
                                                </td>
                                            );
                                        })}
                                        <td className="py-3 text-right font-semibold">
                                            {runtime.mode === "ICPC"
                                                ? row.solved
                                                : row.score}
                                        </td>
                                        {runtime.mode === "ICPC" && (
                                            <td className="py-3 text-right">
                                                {row.penalty}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>

            <section className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <UserPlus className="h-4 w-4" />
                            참가자
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2">
                            <Input
                                value={participantName}
                                onChange={(event) =>
                                    setParticipantName(event.target.value)
                                }
                                placeholder="참가자 이름"
                                disabled={!canRegister}
                            />
                            <Button
                                onClick={addParticipant}
                                disabled={!canRegister || busy}
                            >
                                등록
                            </Button>
                        </div>
                        <div className="mt-4 max-h-56 divide-y overflow-auto rounded-md border">
                            {participants.length === 0 ? (
                                <p className="p-5 text-center text-sm text-muted-foreground">
                                    등록된 참가자가 없습니다.
                                </p>
                            ) : (
                                participants.map((participant) => (
                                    <div key={participant.id} className="px-3 py-2 text-sm">
                                        {participant.name}
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <Radio className="h-4 w-4" />
                            제출 입력
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>참가자</Label>
                                <select
                                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                    value={selectedParticipant}
                                    onChange={(event) =>
                                        setSelectedParticipant(event.target.value)
                                    }
                                >
                                    <option value="">선택</option>
                                    {participants.map((participant) => (
                                        <option key={participant.id} value={participant.id}>
                                            {participant.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>문제</Label>
                                <select
                                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                    value={selectedProblem}
                                    onChange={(event) =>
                                        setSelectedProblem(event.target.value)
                                    }
                                >
                                    {runtime.problems.map((problem) => (
                                        <option key={problem.id} value={problem.id}>
                                            {problem.label}. {problem.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>
                                {activeProblem?.kind === "CODE"
                                    ? "소스 코드"
                                    : activeProblem?.kind === "MANUAL"
                                      ? "제출 내용"
                                      : "답안"}
                            </Label>
                            <textarea
                                className="min-h-28 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
                                value={payload}
                                onChange={(event) => setPayload(event.target.value)}
                                disabled={!canSubmit}
                            />
                        </div>
                        <Button
                            className="w-full"
                            disabled={!canSubmit || busy}
                            onClick={submit}
                        >
                            엔진에 제출
                        </Button>
                    </CardContent>
                </Card>
            </section>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">제출 및 채점 큐</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    {submissions.length === 0 ? (
                        <p className="py-10 text-center text-sm text-muted-foreground">
                            제출이 없습니다.
                        </p>
                    ) : (
                        <table className="w-full min-w-[720px] text-sm">
                            <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground">
                                    <th className="pb-3 font-medium">시각</th>
                                    <th className="pb-3 font-medium">참가자</th>
                                    <th className="pb-3 font-medium">문제</th>
                                    <th className="pb-3 font-medium">결과</th>
                                    <th className="pb-3 text-right font-medium">점수</th>
                                    <th className="pb-3 text-right font-medium">운영</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...submissions].reverse().map((submission) => (
                                    <tr key={submission.id} className="border-b last:border-0">
                                        <td className="py-3 text-xs text-muted-foreground">
                                            {new Date(submission.submitted_at).toLocaleTimeString(
                                                "ko-KR",
                                                { hour: "2-digit", minute: "2-digit" }
                                            )}
                                        </td>
                                        <td className="py-3">
                                            {participantMap.get(submission.participant_id)?.name ||
                                                "알 수 없음"}
                                        </td>
                                        <td className="py-3">
                                            {problemMap.get(submission.runtime_problem_id)?.label ||
                                                "—"}
                                        </td>
                                        <td className="py-3 font-mono text-xs">
                                            {submission.verdict}
                                        </td>
                                        <td className="py-3 text-right">
                                            {submission.score}
                                        </td>
                                        <td className="py-3 text-right">
                                            {submission.verdict === "QUEUED" ? (
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            void judge(
                                                                submission,
                                                                "ACCEPTED"
                                                            )
                                                        }
                                                    >
                                                        승인
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            void judge(
                                                                submission,
                                                                "WRONG_ANSWER"
                                                            )
                                                        }
                                                    >
                                                        오답
                                                    </Button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">
                                                    완료
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
