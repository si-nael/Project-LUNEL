"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Schedule, RatingSummary } from "@/types";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
    ArrowLeft,
    Pencil,
    Trash2,
    Clock,
    MapPin,
    History,
    ChevronDown,
    ChevronUp,
    Save,
    X,
} from "lucide-react";

interface HistoryEntry {
    id: string;
    change_type: string;
    changed_by: string;
    previous_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
    changed_at: string;
}

const STATUS_LABELS: Record<string, string> = {
    DRAFT: "초안",
    SCHEDULED: "예정",
    IN_PROGRESS: "진행 중",
    COMPLETED: "완료",
    CANCELLED: "취소",
};

const STATUS_FLOW: Record<string, string[]> = {
    DRAFT: ["SCHEDULED"],
    SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
};

export default function ScheduleDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const scheduleId = params.id as string;

    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [summary, setSummary] = useState<RatingSummary | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(false);

    // Edit mode
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        title: "",
        description: "",
        start_at: "",
        end_at: "",
        base_importance: 50,
        authority_weight: 0,
        location: "",
    });
    const [saving, setSaving] = useState(false);

    // Rating
    const [score, setScore] = useState(3);
    const [comment, setComment] = useState("");
    const [ratingError, setRatingError] = useState("");
    const [ratingSuccess, setRatingSuccess] = useState(false);

    useEffect(() => {
        Promise.all([
            api.get<Schedule>(`/schedules/${scheduleId}`),
            api.get<RatingSummary>(`/schedules/${scheduleId}/ratings-summary`).catch(() => ({ data: null })),
        ])
            .then(([sRes, rRes]) => {
                setSchedule(sRes.data);
                setSummary(rRes.data);
            })
            .catch(() => toast.error("일정을 불러올 수 없습니다."))
            .finally(() => setLoading(false));
    }, [scheduleId]);

    const loadHistory = async () => {
        if (history.length > 0) {
            setShowHistory(!showHistory);
            return;
        }
        try {
            const { data } = await api.get<HistoryEntry[]>(`/schedules/${scheduleId}/history`);
            setHistory(data);
            setShowHistory(true);
        } catch {
            toast.error("변경 이력을 불러올 수 없습니다.");
        }
    };

    const startEdit = () => {
        if (!schedule) return;
        setEditForm({
            title: schedule.title,
            description: schedule.description || "",
            start_at: schedule.start_at.slice(0, 16),
            end_at: schedule.end_at ? schedule.end_at.slice(0, 16) : "",
            base_importance: schedule.base_importance,
            authority_weight: schedule.authority_weight,
            location: schedule.location || "",
        });
        setEditing(true);
    };

    const saveEdit = async () => {
        setSaving(true);
        try {
            const payload: Record<string, unknown> = {};
            if (editForm.title !== schedule!.title) payload.title = editForm.title;
            if (editForm.description !== (schedule!.description || ""))
                payload.description = editForm.description || null;
            if (editForm.start_at !== schedule!.start_at.slice(0, 16))
                payload.start_at = new Date(editForm.start_at).toISOString();
            if (editForm.end_at !== (schedule!.end_at ? schedule!.end_at.slice(0, 16) : ""))
                payload.end_at = editForm.end_at ? new Date(editForm.end_at).toISOString() : null;
            if (editForm.base_importance !== schedule!.base_importance)
                payload.base_importance = editForm.base_importance;
            if (editForm.authority_weight !== schedule!.authority_weight)
                payload.authority_weight = editForm.authority_weight;
            if (editForm.location !== (schedule!.location || ""))
                payload.location = editForm.location || null;

            if (Object.keys(payload).length === 0) {
                setEditing(false);
                return;
            }

            const { data } = await api.patch<Schedule>(`/schedules/${scheduleId}`, payload);
            setSchedule(data);
            setEditing(false);
            setHistory([]); // invalidate
            toast.success("일정이 수정되었습니다.");
        } catch {
            toast.error("수정에 실패했습니다.");
        }
        setSaving(false);
    };

    const changeStatus = async (newStatus: string) => {
        try {
            const { data } = await api.patch<Schedule>(`/schedules/${scheduleId}`, { status: newStatus });
            setSchedule(data);
            setHistory([]);
            toast.success(`상태가 "${STATUS_LABELS[newStatus]}"(으)로 변경되었습니다.`);
        } catch {
            toast.error("상태 변경에 실패했습니다.");
        }
    };

    const deleteSchedule = async () => {
        if (!confirm("이 일정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
        try {
            await api.delete(`/schedules/${scheduleId}`);
            toast.success("일정이 삭제되었습니다.");
            router.push("/dashboard/schedules");
        } catch {
            toast.error("삭제에 실패했습니다.");
        }
    };

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
            // Refresh schedule to show updated feedback_weight
            const sRes = await api.get<Schedule>(`/schedules/${scheduleId}`);
            setSchedule(sRes.data);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { detail?: any } } };
            const detail = axiosErr.response?.data?.detail;
            const msg = Array.isArray(detail) ? detail[0]?.msg : detail;
            setRatingError(typeof msg === "string" ? msg : "평가 제출에 실패했습니다.");
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
    const canEdit = isOwner || user?.role === "ADMIN" || user?.role === "TEACHER";
    const nextStatuses = STATUS_FLOW[schedule.status] || [];

    return (
        <div className="max-w-3xl">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/schedules">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex-1 min-w-0">
                    {editing ? (
                        <Input
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className="text-lg font-semibold"
                        />
                    ) : (
                        <h1 className="text-xl font-semibold tracking-tight truncate">{schedule.title}</h1>
                    )}
                </div>
                {canEdit && !editing && (
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={startEdit}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={deleteSchedule} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                {editing && (
                    <div className="flex items-center gap-1">
                        <Button size="sm" onClick={saveEdit} disabled={saving}>
                            <Save className="h-3.5 w-3.5 mr-1" />
                            저장
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                )}
            </div>

            {/* Status + type badges + quick status change */}
            <div className="flex items-center gap-2 mb-6 flex-wrap">
                <Badge variant="outline">{schedule.type}</Badge>
                <Badge variant="outline">{schedule.subtype}</Badge>
                <Badge variant="secondary">{STATUS_LABELS[schedule.status] || schedule.status}</Badge>
                {canEdit && nextStatuses.length > 0 && (
                    <>
                        <span className="text-muted-foreground text-xs">→</span>
                        {nextStatuses.map((ns) => (
                            <Button key={ns} variant="outline" size="sm" className="h-6 text-xs" onClick={() => changeStatus(ns)}>
                                {STATUS_LABELS[ns]}
                            </Button>
                        ))}
                    </>
                )}
            </div>

            {/* Description (editable) */}
            {editing ? (
                <div className="mb-6">
                    <Label className="mb-1 block text-xs">설명</Label>
                    <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        rows={3}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                </div>
            ) : (
                schedule.description && (
                    <p className="text-muted-foreground mb-6 whitespace-pre-wrap">{schedule.description}</p>
                )
            )}

            {/* Date / Location (editable) */}
            {editing ? (
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <Label className="text-xs mb-1 block">시작</Label>
                        <Input
                            type="datetime-local"
                            value={editForm.start_at}
                            onChange={(e) => setEditForm({ ...editForm, start_at: e.target.value })}
                        />
                    </div>
                    <div>
                        <Label className="text-xs mb-1 block">종료</Label>
                        <Input
                            type="datetime-local"
                            value={editForm.end_at}
                            onChange={(e) => setEditForm({ ...editForm, end_at: e.target.value })}
                        />
                    </div>
                    <div>
                        <Label className="text-xs mb-1 block">장소</Label>
                        <Input
                            value={editForm.location}
                            onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                            placeholder="선택사항"
                        />
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <Card>
                        <CardContent className="pt-4 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                                <div className="text-xs text-muted-foreground">시작</div>
                                <div className="text-sm font-medium">{new Date(schedule.start_at).toLocaleString("ko-KR")}</div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                                <div className="text-xs text-muted-foreground">종료</div>
                                <div className="text-sm font-medium">
                                    {schedule.end_at ? new Date(schedule.end_at).toLocaleString("ko-KR") : "—"}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    {schedule.location && (
                        <Card className="col-span-2">
                            <CardContent className="pt-4 flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div>
                                    <div className="text-xs text-muted-foreground">장소</div>
                                    <div className="text-sm font-medium">{schedule.location}</div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* ═══ IMPORTANCE BREAKDOWN — LUNEL'S CORE DIFFERENTIATOR ═══ */}
            <Card className="mb-6">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">중요도 분석</CardTitle>
                    <p className="text-[11px] text-muted-foreground">
                        5가지 요소가 결합된 동적 점수 — 마감이 다가올수록, 평가가 쌓일수록 변합니다
                    </p>
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-4xl font-bold text-primary">{schedule.importance_score}</span>
                        <span className="text-sm text-muted-foreground">/ 180</span>
                    </div>

                    {/* Editable importance fields */}
                    {editing ? (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs mb-1 block">기본 중요도 (1-100)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={editForm.base_importance}
                                    onChange={(e) => setEditForm({ ...editForm, base_importance: Number(e.target.value) })}
                                />
                            </div>
                            {(user?.role === "TEACHER" || user?.role === "ADMIN") && (
                                <div>
                                    <Label className="text-xs mb-1 block">권위 가중치 (0-30)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={30}
                                        value={editForm.authority_weight}
                                        onChange={(e) => setEditForm({ ...editForm, authority_weight: Number(e.target.value) })}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {[
                                { label: "기본 중요도", desc: "생성 시 직접 설정", value: schedule.base_importance, max: 100, color: "bg-blue-500" },
                                { label: "권위 가중치", desc: "교사/관리자 강조", value: schedule.authority_weight, max: 30, color: "bg-violet-500" },
                                { label: "긴급도", desc: "마감 접근 시 자동 상승", value: schedule.urgency_weight, max: 20, color: "bg-red-500" },
                                { label: "피드백", desc: "동료 평가 평균 반영", value: schedule.feedback_weight, max: 20, color: "bg-amber-500" },
                                { label: "의존성", desc: "프로젝트 연계 가중치", value: schedule.dependency_weight, max: 10, color: "bg-emerald-500" },
                            ].map((item) => (
                                <div key={item.label}>
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className={cn("w-2 h-2 rounded-full shrink-0", item.color)} />
                                            <span className="text-xs font-medium">{item.label}</span>
                                            <span className="text-[10px] text-muted-foreground">{item.desc}</span>
                                        </div>
                                        <span className="text-xs font-bold">{item.value}<span className="text-muted-foreground font-normal">/{item.max}</span></span>
                                    </div>
                                    <div className="flex-1 bg-foreground/[0.04] rounded-full h-2">
                                        <div
                                            className={cn(item.color, "rounded-full h-2 transition-all")}
                                            style={{ width: `${(item.value / item.max) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* RATING SUMMARY */}
            {summary && summary.total_ratings > 0 && (
                <Card className="mb-6">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">동료 평가</CardTitle>
                        <p className="text-[11px] text-muted-foreground">
                            평가 점수는 피드백 가중치에 자동 반영됩니다 (평균 {summary.avg_score.toFixed(1)} → 피드백 {schedule.feedback_weight}점)
                        </p>
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

            {/* RATE (not own schedule) */}
            {!isOwner && (
                <Card className="mb-6">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">평가하기</CardTitle>
                        <p className="text-[11px] text-muted-foreground">
                            당신의 평가가 이 일정의 중요도에 반영됩니다
                        </p>
                    </CardHeader>
                    <CardContent>
                        {ratingSuccess && (
                            <div className="bg-emerald-500/10 text-emerald-600 p-3 rounded-md mb-4 text-sm">
                                평가가 제출되었습니다! 피드백 가중치가 업데이트됩니다.
                            </div>
                        )}
                        {ratingError && (
                            <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4 text-sm">
                                {ratingError}
                            </div>
                        )}

                        <div className="mb-4">
                            <Label className="mb-2 block text-xs">점수 (1~5)</Label>
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
                            <Label className="mb-1 block text-xs">코멘트 (선택)</Label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={2}
                                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                        </div>

                        <Button onClick={submitRating} size="sm">제출</Button>
                    </CardContent>
                </Card>
            )}

            {/* HISTORY — Time travel auditing */}
            <div className="mb-6">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={loadHistory}
                    className="w-full justify-between"
                >
                    <span className="flex items-center gap-2">
                        <History className="h-3.5 w-3.5" />
                        변경 이력 보기
                    </span>
                    {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>

                {showHistory && (
                    <Card className="mt-2">
                        <CardContent className="pt-4">
                            {history.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-4">변경 이력이 없습니다.</p>
                            ) : (
                                <div className="space-y-3">
                                    {history.map((h) => (
                                        <div key={h.id} className="relative pl-4 border-l-2 border-border/50 pb-3 last:pb-0">
                                            <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-primary" />
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge
                                                    variant={h.change_type === "CREATE" ? "default" : h.change_type === "DELETE" ? "destructive" : "secondary"}
                                                    className="text-[10px]"
                                                >
                                                    {h.change_type}
                                                </Badge>
                                                <span className="text-[11px] text-muted-foreground">
                                                    {new Date(h.changed_at).toLocaleString("ko-KR")}
                                                </span>
                                            </div>
                                            {h.change_type === "UPDATE" && h.previous_data && h.new_data && (
                                                <div className="text-xs space-y-0.5">
                                                    {Object.keys(h.new_data).map((key) => {
                                                        const prev = (h.previous_data as Record<string, unknown>)?.[key];
                                                        const next = (h.new_data as Record<string, unknown>)?.[key];
                                                        if (JSON.stringify(prev) === JSON.stringify(next)) return null;
                                                        return (
                                                            <div key={key} className="flex items-center gap-1">
                                                                <span className="text-muted-foreground font-medium">{key}:</span>
                                                                <span className="text-red-400 line-through">{String(prev ?? "없음")}</span>
                                                                <span className="text-muted-foreground">→</span>
                                                                <span className="text-emerald-500">{String(next ?? "없음")}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
