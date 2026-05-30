"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Competition, Participant, Submission, Scoreboard } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
    ArrowLeft,
    Trophy,
    Users,
    FileText,
    CheckCircle,
    Clock,
    Award,
    Send,
    Star,
} from "lucide-react";

/* ───────── local interfaces ───────── */

interface Event {
    id: string;
    event_type: string;
    title: string;
    status: string;
    created_at: string;
}

interface ScoreboardEntry {
    rank: number;
    participant_id: string;
    user_id: string;
    score: number | null;
    submitted_at: string | null;
}

/* ───────── constants ───────── */

const STATUS_LABELS: Record<string, string> = {
    PLANNED: "준비중",
    REGISTRATION_OPEN: "접수중",
    IN_PROGRESS: "진행중",
    JUDGING: "심사중",
    COMPLETED: "완료",
    CANCELLED: "취소",
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    PLANNED: "secondary",
    REGISTRATION_OPEN: "default",
    IN_PROGRESS: "default",
    JUDGING: "default",
    COMPLETED: "secondary",
    CANCELLED: "destructive",
};

const STATUS_FLOW: Record<string, string[]> = {
    PLANNED: ["REGISTRATION_OPEN"],
    REGISTRATION_OPEN: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["JUDGING", "CANCELLED"],
    JUDGING: ["COMPLETED"],
    COMPLETED: [],
    CANCELLED: [],
};

const MEDAL_COLORS: Record<number, string> = {
    1: "#FFD700",
    2: "#C0C0C0",
    3: "#CD7F32",
};

const MEDAL_LABELS: Record<number, string> = {
    1: "🥇",
    2: "🥈",
    3: "🥉",
};

/* ───────── component ───────── */

export default function CompetitionDetailPage() {
    const params = useParams();
    const { user } = useAuth();
    const competitionId = params.id as string;

    const isPrivileged = user?.role === "TEACHER" || user?.role === "ADMIN";

    // Core data
    const [competition, setCompetition] = useState<Competition | null>(null);
    const [event, setEvent] = useState<Event | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null);
    const [loading, setLoading] = useState(true);

    // Action states
    const [joining, setJoining] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submissionText, setSubmissionText] = useState("");
    const [gradeScores, setGradeScores] = useState<Record<string, number>>({});
    const [gradingId, setGradingId] = useState<string | null>(null);
    const [generatingScoreboard, setGeneratingScoreboard] = useState(false);

    // Leaderboard animation
    const [leaderboardVisible, setLeaderboardVisible] = useState(false);

    /* ── data loading ── */

    const loadCompetition = useCallback(async () => {
        try {
            const { data } = await api.get<Competition>(`/competitions/${competitionId}`);
            setCompetition(data);
            // Load linked event
            try {
                const eventRes = await api.get<Event>(`/events/${data.event_id}`);
                setEvent(eventRes.data);
            } catch {
                // Event might not be accessible
            }
        } catch {
            toast.error("대회 정보를 불러올 수 없습니다.");
        }
    }, [competitionId]);

    const loadParticipants = useCallback(async () => {
        try {
            const { data } = await api.get<Participant[]>(`/competitions/${competitionId}/participants`);
            setParticipants(data);
        } catch {
            // No participants yet
        }
    }, [competitionId]);

    const loadSubmissions = useCallback(async () => {
        try {
            const { data } = await api.get<Submission[]>(`/competitions/${competitionId}/submissions`);
            setSubmissions(data);
        } catch {
            // No submissions or not authorized
        }
    }, [competitionId]);

    const loadScoreboard = useCallback(async () => {
        try {
            const { data } = await api.get<Scoreboard>(`/competitions/${competitionId}/scoreboard`);
            setScoreboard(data);
            // Trigger animation after a short delay
            setTimeout(() => setLeaderboardVisible(true), 100);
        } catch {
            // No scoreboard generated yet
            setScoreboard(null);
        }
    }, [competitionId]);

    useEffect(() => {
        Promise.all([
            loadCompetition(),
            loadParticipants(),
            loadSubmissions(),
            loadScoreboard(),
        ]).finally(() => setLoading(false));
    }, [loadCompetition, loadParticipants, loadSubmissions, loadScoreboard]);

    /* ── status change ── */

    const changeStatus = async (newStatus: string) => {
        if (!event) return;
        try {
            const { data } = await api.patch<Event>(`/events/${event.id}`, { status: newStatus });
            setEvent(data);
            toast.success(`상태가 "${STATUS_LABELS[newStatus]}"(으)로 변경되었습니다.`);
        } catch {
            toast.error("상태 변경에 실패했습니다.");
        }
    };

    /* ── participant registration ── */

    const joinCompetition = async () => {
        setJoining(true);
        try {
            await api.post(`/competitions/${competitionId}/participants`);
            toast.success("참가 신청이 완료되었습니다.");
            await loadParticipants();
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { detail?: string } } };
            toast.error(axiosErr.response?.data?.detail || "참가 신청에 실패했습니다.");
        }
        setJoining(false);
    };

    /* ── submission ── */

    const submitAnswer = async () => {
        if (!submissionText.trim()) {
            toast.error("제출 내용을 입력해주세요.");
            return;
        }
        setSubmitting(true);
        try {
            await api.post(`/competitions/${competitionId}/submissions`, {
                content: { text: submissionText },
            });
            toast.success("제출이 완료되었습니다.");
            setSubmissionText("");
            await loadSubmissions();
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { detail?: string } } };
            toast.error(axiosErr.response?.data?.detail || "제출에 실패했습니다.");
        }
        setSubmitting(false);
    };

    /* ── grading ── */

    const gradeSubmission = async (submissionId: string) => {
        const score = gradeScores[submissionId];
        if (score === undefined || score < 0 || score > 100) {
            toast.error("점수는 0~100 사이의 숫자를 입력해주세요.");
            return;
        }
        setGradingId(submissionId);
        try {
            await api.patch(`/competitions/${competitionId}/submissions/${submissionId}/grade`, {
                score,
            });
            toast.success("채점이 완료되었습니다.");
            await loadSubmissions();
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { detail?: string } } };
            toast.error(axiosErr.response?.data?.detail || "채점에 실패했습니다.");
        }
        setGradingId(null);
    };

    /* ── scoreboard ── */

    const generateScoreboard = async () => {
        setGeneratingScoreboard(true);
        try {
            await api.post(`/competitions/${competitionId}/scoreboard`);
            toast.success("리더보드가 생성되었습니다.");
            setLeaderboardVisible(false);
            await loadScoreboard();
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { detail?: string } } };
            toast.error(axiosErr.response?.data?.detail || "리더보드 생성에 실패했습니다.");
        }
        setGeneratingScoreboard(false);
    };

    /* ── derived values ── */

    const currentStatus = event?.status || "PLANNED";
    const nextStatuses = STATUS_FLOW[currentStatus] || [];
    const isRegistered = participants.some((p) => p.user_id === user?.id);
    const mySubmission = submissions.find((s) => {
        const myParticipant = participants.find((p) => p.user_id === user?.id);
        return myParticipant && s.participant_id === myParticipant.id;
    });
    const gradedCount = submissions.filter((s) => s.score !== null).length;
    const ungradedCount = submissions.length - gradedCount;

    const scoreboardEntries: ScoreboardEntry[] = scoreboard?.snapshot_data
        ? Array.isArray(scoreboard.snapshot_data)
            ? (scoreboard.snapshot_data as unknown as ScoreboardEntry[])
            : (scoreboard.snapshot_data as { entries?: ScoreboardEntry[] }).entries || []
        : [];

    /* ── loading / error states ── */

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            </div>
        );
    }

    if (!competition) {
        return <div className="text-destructive text-sm">대회를 찾을 수 없습니다.</div>;
    }

    return (
        <div className="max-w-4xl">
            {/* ═══ Header ═══ */}
            <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/competitions">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-semibold tracking-tight truncate">
                        {event?.title || "대회 상세"}
                    </h1>
                </div>
            </div>

            {/* ═══ Status badges + flow buttons ═══ */}
            <div className="flex items-center gap-2 mb-6 flex-wrap">
                <Badge variant={STATUS_COLORS[currentStatus] || "secondary"}>
                    {STATUS_LABELS[currentStatus] || currentStatus}
                </Badge>
                <Badge variant="outline" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {participants.length}
                    {competition.max_participants ? ` / ${competition.max_participants}` : ""} 명
                </Badge>
                {isPrivileged && nextStatuses.length > 0 && (
                    <>
                        <span className="text-muted-foreground text-xs">→</span>
                        {nextStatuses.map((ns) => (
                            <Button
                                key={ns}
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => changeStatus(ns)}
                            >
                                {STATUS_LABELS[ns]}
                            </Button>
                        ))}
                    </>
                )}
            </div>

            {/* ═══ Tabs ═══ */}
            <Tabs defaultValue="info" className="w-full">
                <TabsList className="w-full grid grid-cols-5">
                    <TabsTrigger value="info">정보</TabsTrigger>
                    <TabsTrigger value="participants">참가자</TabsTrigger>
                    <TabsTrigger value="submissions">제출</TabsTrigger>
                    <TabsTrigger value="grading">채점</TabsTrigger>
                    <TabsTrigger value="leaderboard">리더보드</TabsTrigger>
                </TabsList>

                {/* ── Tab: 정보 ── */}
                <TabsContent value="info">
                    <div className="glass rounded-2xl p-5 mt-4">
                        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-primary" />
                            대회 정보
                        </h2>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="p-3 rounded-xl bg-secondary/50">
                                <p className="text-xs text-muted-foreground">최대 참가 인원</p>
                                <p className="text-lg font-semibold mt-1">
                                    {competition.max_participants ?? "제한 없음"}
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-secondary/50">
                                <p className="text-xs text-muted-foreground">현재 참가자</p>
                                <p className="text-lg font-semibold mt-1">
                                    {participants.length}명
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-secondary/50">
                                <p className="text-xs text-muted-foreground">제출 현황</p>
                                <p className="text-lg font-semibold mt-1">
                                    {submissions.length}건
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-secondary/50">
                                <p className="text-xs text-muted-foreground">채점 진행</p>
                                <p className="text-lg font-semibold mt-1">
                                    <span className="text-emerald-500">{gradedCount}</span>
                                    <span className="text-muted-foreground text-sm"> / {submissions.length}</span>
                                </p>
                            </div>
                        </div>

                        {competition.scoring_rule && (
                            <div className="p-3 rounded-xl bg-secondary/50">
                                <p className="text-xs text-muted-foreground mb-1">채점 기준</p>
                                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                                    {JSON.stringify(competition.scoring_rule, null, 2)}
                                </pre>
                            </div>
                        )}

                        {/* State flow visualization */}
                        <div className="mt-6">
                            <p className="text-xs text-muted-foreground mb-3">진행 흐름</p>
                            <div className="flex items-center gap-1 overflow-x-auto pb-2">
                                {["PLANNED", "REGISTRATION_OPEN", "IN_PROGRESS", "JUDGING", "COMPLETED"].map(
                                    (status, idx) => (
                                        <div key={status} className="flex items-center gap-1 shrink-0">
                                            <div
                                                className={cn(
                                                    "px-2.5 py-1 rounded-md text-[10px] font-medium transition-all",
                                                    currentStatus === status
                                                        ? "bg-primary text-primary-foreground shadow-sm"
                                                        : ["PLANNED", "REGISTRATION_OPEN", "IN_PROGRESS", "JUDGING", "COMPLETED"]
                                                            .indexOf(currentStatus) > idx
                                                            ? "bg-primary/20 text-primary"
                                                            : "bg-secondary/50 text-muted-foreground"
                                                )}
                                            >
                                                {STATUS_LABELS[status]}
                                            </div>
                                            {idx < 4 && (
                                                <span className="text-muted-foreground/40 text-xs">→</span>
                                            )}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* ── Tab: 참가자 ── */}
                <TabsContent value="participants">
                    <div className="glass rounded-2xl p-5 mt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold flex items-center gap-2">
                                <Users className="h-4 w-4 text-primary" />
                                참가자 ({participants.length}명)
                            </h2>
                            {!isRegistered && (
                                <Button size="sm" disabled={joining} onClick={joinCompetition}>
                                    <Users className="h-3.5 w-3.5 mr-1.5" />
                                    {joining ? "신청 중..." : "참가 신청"}
                                </Button>
                            )}
                            {isRegistered && (
                                <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    참가 등록됨
                                </Badge>
                            )}
                        </div>

                        {participants.length === 0 ? (
                            <div className="text-center py-8">
                                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground">
                                    아직 참가자가 없습니다.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {participants.map((p, idx) => (
                                    <div
                                        key={p.id}
                                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-muted-foreground w-6 text-right">
                                                {idx + 1}
                                            </span>
                                            <span className="text-sm">
                                                {p.user_id === user?.id ? (
                                                    <span className="font-medium text-primary">나</span>
                                                ) : (
                                                    p.user_id.slice(0, 8) + "..."
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-muted-foreground">
                                                {new Date(p.registered_at).toLocaleDateString("ko-KR")}
                                            </span>
                                            <Badge variant="outline" className="text-[10px]">
                                                {p.status}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* ── Tab: 제출 ── */}
                <TabsContent value="submissions">
                    <div className="glass rounded-2xl p-5 mt-4">
                        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            제출
                        </h2>

                        {/* Own submission status */}
                        {mySubmission && (
                            <Card className="mb-4 border-emerald-500/20">
                                <CardContent className="pt-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                                        <span className="text-sm font-medium text-emerald-500">제출 완료</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {new Date(mySubmission.submitted_at).toLocaleString("ko-KR")}
                                        </span>
                                        {mySubmission.score !== null && (
                                            <span className="flex items-center gap-1">
                                                <Star className="h-3 w-3 text-amber-500" />
                                                {mySubmission.score}점
                                            </span>
                                        )}
                                    </div>
                                    {mySubmission.content && (
                                        <div className="mt-2 p-2 rounded-md bg-secondary/50 text-xs text-muted-foreground">
                                            {(mySubmission.content as { text?: string }).text || JSON.stringify(mySubmission.content)}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Submit form — only for registered participants without existing submission */}
                        {isRegistered && !mySubmission && (
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-xs mb-1 block">제출 내용</Label>
                                    <textarea
                                        value={submissionText}
                                        onChange={(e) => setSubmissionText(e.target.value)}
                                        rows={5}
                                        placeholder="답안을 입력하세요..."
                                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    />
                                </div>
                                <Button onClick={submitAnswer} disabled={submitting} size="sm">
                                    <Send className="h-3.5 w-3.5 mr-1.5" />
                                    {submitting ? "제출 중..." : "제출하기"}
                                </Button>
                            </div>
                        )}

                        {!isRegistered && (
                            <div className="text-center py-8">
                                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground">
                                    참가 등록 후 제출할 수 있습니다.
                                </p>
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* ── Tab: 채점 (Teacher/Admin only) ── */}
                <TabsContent value="grading">
                    <div className="glass rounded-2xl p-5 mt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold flex items-center gap-2">
                                <Award className="h-4 w-4 text-primary" />
                                채점
                            </h2>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                    <span className="text-emerald-500">{gradedCount}</span>
                                    <span className="text-muted-foreground mx-1">/</span>
                                    <span>{submissions.length}</span>
                                    <span className="text-muted-foreground ml-1">채점됨</span>
                                </Badge>
                                {ungradedCount > 0 && (
                                    <Badge variant="destructive" className="text-[10px]">
                                        {ungradedCount}건 미채점
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {!isPrivileged ? (
                            <div className="text-center py-8">
                                <Award className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground">
                                    교사 또는 관리자만 채점할 수 있습니다.
                                </p>
                            </div>
                        ) : submissions.length === 0 ? (
                            <div className="text-center py-8">
                                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground">
                                    아직 제출된 답안이 없습니다.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {submissions.map((s) => (
                                    <Card key={s.id} className={cn(
                                        "transition-all",
                                        s.score !== null && "border-emerald-500/20"
                                    )}>
                                        <CardContent className="pt-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs font-medium">
                                                            참가자: {s.participant_id.slice(0, 8)}...
                                                        </span>
                                                        {s.score !== null && (
                                                            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px]">
                                                                {s.score}점
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mb-2">
                                                        <Clock className="h-3 w-3 inline mr-1" />
                                                        {new Date(s.submitted_at).toLocaleString("ko-KR")}
                                                        {s.graded_at && (
                                                            <span className="ml-2">
                                                                · 채점: {new Date(s.graded_at).toLocaleString("ko-KR")}
                                                            </span>
                                                        )}
                                                    </p>
                                                    {s.content && (
                                                        <div className="p-2 rounded-md bg-secondary/50 text-xs">
                                                            {(s.content as { text?: string }).text || JSON.stringify(s.content)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        placeholder="점수"
                                                        className="w-20 h-8 text-sm"
                                                        value={gradeScores[s.id] ?? (s.score ?? "")}
                                                        onChange={(e) =>
                                                            setGradeScores({
                                                                ...gradeScores,
                                                                [s.id]: Number(e.target.value),
                                                            })
                                                        }
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="h-8"
                                                        disabled={gradingId === s.id}
                                                        onClick={() => gradeSubmission(s.id)}
                                                    >
                                                        {gradingId === s.id ? "..." : "채점"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* ── Tab: 리더보드 ── */}
                <TabsContent value="leaderboard">
                    <div className="glass rounded-2xl p-5 mt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold flex items-center gap-2">
                                <Trophy className="h-4 w-4 text-amber-500" />
                                리더보드
                            </h2>
                            {isPrivileged && (
                                <Button
                                    size="sm"
                                    onClick={generateScoreboard}
                                    disabled={generatingScoreboard}
                                >
                                    <Trophy className="h-3.5 w-3.5 mr-1.5" />
                                    {generatingScoreboard ? "생성 중..." : scoreboard ? "리더보드 갱신" : "리더보드 생성"}
                                </Button>
                            )}
                        </div>

                        {!scoreboard ? (
                            <div className="text-center py-8">
                                <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground">
                                    리더보드가 아직 생성되지 않았습니다.
                                </p>
                            </div>
                        ) : scoreboardEntries.length === 0 ? (
                            <div className="text-center py-8">
                                <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground">
                                    리더보드 데이터가 없습니다.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Top 3 podium */}
                                {scoreboardEntries.length >= 3 && (
                                    <div className="flex items-end justify-center gap-3 mb-6 pt-4">
                                        {[1, 0, 2].map((displayIdx) => {
                                            const entry = scoreboardEntries[displayIdx];
                                            if (!entry) return null;
                                            const rank = displayIdx + 1;
                                            const heights: Record<number, string> = { 1: "h-24", 2: "h-32", 3: "h-20" };
                                            return (
                                                <div
                                                    key={entry.participant_id}
                                                    className={cn(
                                                        "flex flex-col items-center transition-all duration-700",
                                                        leaderboardVisible
                                                            ? "opacity-100 translate-y-0"
                                                            : "opacity-0 translate-y-4"
                                                    )}
                                                    style={{ transitionDelay: `${rank * 150}ms` }}
                                                >
                                                    <span className="text-2xl mb-1">{MEDAL_LABELS[rank]}</span>
                                                    <div
                                                        className={cn(
                                                            "w-16 rounded-t-lg flex items-center justify-center",
                                                            heights[rank]
                                                        )}
                                                        style={{
                                                            background: `linear-gradient(180deg, ${MEDAL_COLORS[rank]}40, ${MEDAL_COLORS[rank]}15)`,
                                                            borderTop: `2px solid ${MEDAL_COLORS[rank]}`,
                                                        }}
                                                    >
                                                        <span className="text-sm font-bold">
                                                            {entry.score ?? "—"}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground mt-1 max-w-[60px] truncate">
                                                        {entry.user_id?.slice(0, 6) ?? entry.participant_id.slice(0, 6)}...
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Full ranking table */}
                                <div className="rounded-lg border border-border/50 overflow-hidden">
                                    <div className="grid grid-cols-[48px_1fr_80px_120px] gap-2 px-3 py-2 bg-secondary/30 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                        <span>순위</span>
                                        <span>참가자</span>
                                        <span className="text-right">점수</span>
                                        <span className="text-right">제출 시각</span>
                                    </div>
                                    {scoreboardEntries.map((entry, idx) => {
                                        const rank = entry.rank ?? idx + 1;
                                        return (
                                            <div
                                                key={entry.participant_id}
                                                className={cn(
                                                    "grid grid-cols-[48px_1fr_80px_120px] gap-2 px-3 py-2.5 items-center border-t border-border/30 transition-all duration-500",
                                                    leaderboardVisible
                                                        ? "opacity-100 translate-x-0"
                                                        : "opacity-0 -translate-x-4",
                                                    entry.user_id === user?.id && "bg-primary/5"
                                                )}
                                                style={{ transitionDelay: `${idx * 80}ms` }}
                                            >
                                                <span className="text-sm font-bold">
                                                    {rank <= 3 ? (
                                                        <span
                                                            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                                                            style={{
                                                                backgroundColor: `${MEDAL_COLORS[rank]}25`,
                                                                color: MEDAL_COLORS[rank],
                                                            }}
                                                        >
                                                            {rank}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">{rank}</span>
                                                    )}
                                                </span>
                                                <span className="text-sm truncate">
                                                    {entry.user_id === user?.id ? (
                                                        <span className="font-medium text-primary">나</span>
                                                    ) : (
                                                        `${(entry.user_id ?? entry.participant_id).slice(0, 8)}...`
                                                    )}
                                                </span>
                                                <span className="text-sm font-semibold text-right">
                                                    {entry.score ?? "—"}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground text-right">
                                                    {entry.submitted_at
                                                        ? new Date(entry.submitted_at).toLocaleString("ko-KR", {
                                                            month: "short",
                                                            day: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })
                                                        : "—"}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Scoreboard metadata */}
                                <div className="flex items-center justify-between mt-3 text-[10px] text-muted-foreground">
                                    <span>
                                        {scoreboard.is_final ? "최종 결과" : "임시 결과"}
                                    </span>
                                    <span>
                                        생성: {new Date(scoreboard.created_at).toLocaleString("ko-KR")}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
