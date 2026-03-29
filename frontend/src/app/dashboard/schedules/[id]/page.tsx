"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Schedule, RatingSummary } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function ScheduleDetailPage() {
    const params = useParams();
    const { user } = useAuth();
    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [summary, setSummary] = useState<RatingSummary | null>(null);
    const [loading, setLoading] = useState(true);

    const [score, setScore] = useState(3);
    const [comment, setComment] = useState("");
    const [ratingError, setRatingError] = useState("");
    const [ratingSuccess, setRatingSuccess] = useState(false);

    const scheduleId = params.id as string;

    useEffect(() => {
        Promise.all([
            api.get<Schedule>(`/schedules/${scheduleId}`),
            api.get<RatingSummary>(`/schedules/${scheduleId}/ratings-summary`),
        ])
            .then(([sRes, rRes]) => {
                setSchedule(sRes.data);
                setSummary(rRes.data);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [scheduleId]);

    const submitRating = async () => {
        setRatingError("");
        setRatingSuccess(false);
        try {
            await api.post(`/schedules/${scheduleId}/ratings`, {
                score,
                comment: comment || undefined,
            });
            setRatingSuccess(true);
            const { data } = await api.get<RatingSummary>(`/schedules/${scheduleId}/ratings-summary`);
            setSummary(data);
        } catch (err: unknown) {
            const msg =
                err && typeof err === "object" && "response" in err
                    ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
                    : undefined;
            setRatingError(msg || "평가 제출에 실패했습니다.");
        }
    };

    if (loading)
        return (
            <div className="flex justify-center py-20">
                <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            </div>
        );
    if (!schedule) return <div className="text-destructive text-sm">일정을 찾을 수 없습니다.</div>;

    const isOwner = user?.id === schedule.creator_id;

    return (
        <div className="max-w-3xl">
            <h1 className="text-xl font-semibold tracking-tight mb-2">{schedule.title}</h1>

            <div className="flex items-center gap-2 mb-6">
                <Badge variant="outline">{schedule.type}</Badge>
                <Badge variant="outline">{schedule.subtype}</Badge>
                <Badge variant="secondary">{schedule.status}</Badge>
            </div>

            {schedule.description && (
                <p className="text-muted-foreground mb-6 whitespace-pre-wrap">{schedule.description}</p>
            )}

            <div className="grid grid-cols-2 gap-4 mb-8">
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-xs text-muted-foreground mb-1">시작</div>
                        <div className="font-medium">{new Date(schedule.start_at).toLocaleString("ko-KR")}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-xs text-muted-foreground mb-1">종료</div>
                        <div className="font-medium">
                            {schedule.end_at ? new Date(schedule.end_at).toLocaleString("ko-KR") : "—"}
                        </div>
                    </CardContent>
                </Card>
                {schedule.location && (
                    <Card>
                        <CardContent className="pt-4">
                            <div className="text-xs text-muted-foreground mb-1">장소</div>
                            <div className="font-medium">{schedule.location}</div>
                        </CardContent>
                    </Card>
                )}
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-xs text-muted-foreground mb-1">시간대</div>
                        <div className="font-medium">{schedule.timezone}</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="text-sm">중요도 분석</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-primary mb-4">{schedule.importance_score}</div>
                    <div className="space-y-2">
                        {[
                            { label: "기본 중요도", value: schedule.base_importance, max: 100 },
                            { label: "권한 가중치", value: schedule.authority_weight, max: 30 },
                            { label: "긴급도", value: schedule.urgency_weight, max: 20 },
                            { label: "피드백", value: schedule.feedback_weight, max: 20 },
                            { label: "의존성", value: schedule.dependency_weight, max: 10 },
                        ].map((item) => (
                            <div key={item.label} className="flex items-center gap-3">
                                <div className="w-24 text-xs text-muted-foreground">{item.label}</div>
                                <div className="flex-1 bg-foreground/[0.04] rounded-full h-1.5">
                                    <div
                                        className="bg-primary/70 rounded-full h-1.5 transition-all"
                                        style={{ width: `${(item.value / item.max) * 100}%` }}
                                    />
                                </div>
                                <div className="w-10 text-right text-xs font-medium text-foreground/60">{item.value}</div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {summary && (
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle className="text-base">평가 현황</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="text-2xl font-bold">{summary.total_ratings}</div>
                                <div className="text-xs text-muted-foreground">총 평가</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-amber-500">{summary.avg_score.toFixed(1)}</div>
                                <div className="text-xs text-muted-foreground">평균 점수</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-emerald-500">
                                    {summary.avg_usefulness?.toFixed(1) ?? "—"}
                                </div>
                                <div className="text-xs text-muted-foreground">유용성</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!isOwner && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">평가하기</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {ratingSuccess && (
                            <div className="bg-emerald-500/10 text-emerald-600 p-3 rounded-md mb-4 text-sm">
                                평가가 제출되었습니다!
                            </div>
                        )}
                        {ratingError && (
                            <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4 text-sm">
                                {ratingError}
                            </div>
                        )}

                        <div className="mb-4">
                            <Label className="mb-2 block">점수 (1~5)</Label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((n) => (
                                    <button
                                        key={n}
                                        onClick={() => setScore(n)}
                                        className={cn(
                                            "w-10 h-10 rounded-md border-2 font-bold transition-colors",
                                            score === n
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border text-muted-foreground hover:border-primary/50"
                                        )}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mb-4">
                            <Label className="mb-1 block">코멘트 (선택)</Label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={3}
                                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                        </div>

                        <Button onClick={submitRating}>제출</Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
