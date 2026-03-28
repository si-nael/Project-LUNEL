"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Schedule, RatingSummary } from "@/types";

export default function ScheduleDetailPage() {
    const params = useParams();
    const { user } = useAuth();
    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [summary, setSummary] = useState<RatingSummary | null>(null);
    const [loading, setLoading] = useState(true);

    // Rating form
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
            // Refresh summary
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

    if (loading) return <div className="text-gray-400">로딩 중...</div>;
    if (!schedule) return <div className="text-red-500">일정을 찾을 수 없습니다.</div>;

    const isOwner = user?.id === schedule.creator_id;

    return (
        <div className="max-w-3xl">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{schedule.title}</h1>

            <div className="flex items-center gap-3 mb-6">
                <span className="text-xs px-2 py-1 bg-gray-100 rounded">{schedule.type}</span>
                <span className="text-xs px-2 py-1 bg-gray-100 rounded">{schedule.subtype}</span>
                <span className="text-xs px-2 py-1 bg-gray-100 rounded">{schedule.status}</span>
            </div>

            {schedule.description && (
                <p className="text-gray-700 mb-6 whitespace-pre-wrap">{schedule.description}</p>
            )}

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white rounded-xl border p-4">
                    <div className="text-xs text-gray-500 mb-1">시작</div>
                    <div className="font-medium">{new Date(schedule.start_at).toLocaleString("ko-KR")}</div>
                </div>
                <div className="bg-white rounded-xl border p-4">
                    <div className="text-xs text-gray-500 mb-1">종료</div>
                    <div className="font-medium">
                        {schedule.end_at ? new Date(schedule.end_at).toLocaleString("ko-KR") : "—"}
                    </div>
                </div>
                {schedule.location && (
                    <div className="bg-white rounded-xl border p-4">
                        <div className="text-xs text-gray-500 mb-1">장소</div>
                        <div className="font-medium">{schedule.location}</div>
                    </div>
                )}
                <div className="bg-white rounded-xl border p-4">
                    <div className="text-xs text-gray-500 mb-1">시간대</div>
                    <div className="font-medium">{schedule.timezone}</div>
                </div>
            </div>

            {/* Importance breakdown */}
            <div className="bg-white rounded-xl border p-6 mb-8">
                <h2 className="text-lg font-semibold mb-4">중요도 분석</h2>
                <div className="text-3xl font-bold text-blue-600 mb-4">{schedule.importance_score}</div>
                <div className="space-y-2">
                    {[
                        { label: "기본 중요도", value: schedule.base_importance, max: 100 },
                        { label: "권한 가중치", value: schedule.authority_weight, max: 30 },
                        { label: "긴급도", value: schedule.urgency_weight, max: 20 },
                        { label: "피드백", value: schedule.feedback_weight, max: 20 },
                        { label: "의존성", value: schedule.dependency_weight, max: 10 },
                    ].map((item) => (
                        <div key={item.label} className="flex items-center gap-3">
                            <div className="w-24 text-sm text-gray-600">{item.label}</div>
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                                <div
                                    className="bg-blue-500 rounded-full h-2 transition-all"
                                    style={{ width: `${(item.value / item.max) * 100}%` }}
                                />
                            </div>
                            <div className="w-12 text-right text-sm font-medium">{item.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Rating summary */}
            {summary && (
                <div className="bg-white rounded-xl border p-6 mb-8">
                    <h2 className="text-lg font-semibold mb-4">평가 현황</h2>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-gray-900">{summary.total_ratings}</div>
                            <div className="text-xs text-gray-500">총 평가</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-yellow-500">{summary.avg_score.toFixed(1)}</div>
                            <div className="text-xs text-gray-500">평균 점수</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-green-600">
                                {summary.avg_usefulness?.toFixed(1) ?? "—"}
                            </div>
                            <div className="text-xs text-gray-500">유용성</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rating form (only if not owner) */}
            {!isOwner && (
                <div className="bg-white rounded-xl border p-6">
                    <h2 className="text-lg font-semibold mb-4">평가하기</h2>

                    {ratingSuccess && (
                        <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm">
                            평가가 제출되었습니다!
                        </div>
                    )}
                    {ratingError && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                            {ratingError}
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">점수 (1~5)</label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                    key={n}
                                    onClick={() => setScore(n)}
                                    className={`w-10 h-10 rounded-lg border-2 font-bold transition-colors ${score === n
                                            ? "border-blue-600 bg-blue-600 text-white"
                                            : "border-gray-200 text-gray-500 hover:border-blue-300"
                                        }`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">코멘트 (선택)</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        onClick={submitRating}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                        제출
                    </button>
                </div>
            )}
        </div>
    );
}
