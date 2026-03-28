"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const SUBTYPES: Record<string, { value: string; label: string }[]> = {
    PROJECT: [
        { value: "PERSONAL_PROJECT", label: "개인 프로젝트" },
        { value: "TEAM_PROJECT", label: "팀 프로젝트" },
        { value: "TEMP_GROUP_PROJECT", label: "임시 그룹 프로젝트" },
    ],
    INTERVAL: [
        { value: "REGISTRATION_WINDOW", label: "접수 기간" },
        { value: "EVENT_WINDOW", label: "행사 기간" },
        { value: "SUBMISSION_WINDOW", label: "제출 기간" },
    ],
    EVENT: [
        { value: "COMPETITION", label: "대회" },
        { value: "PERFORMANCE_TASK", label: "수행평가" },
        { value: "ASSIGNMENT", label: "과제" },
        { value: "MEETING", label: "회의" },
        { value: "GENERAL_EVENT", label: "일반 행사" },
    ],
};

export default function NewSchedulePage() {
    const router = useRouter();
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [type, setType] = useState("EVENT");
    const [subtype, setSubtype] = useState("GENERAL_EVENT");
    const [startAt, setStartAt] = useState("");
    const [endAt, setEndAt] = useState("");
    const [allDay, setAllDay] = useState(false);
    const [location, setLocation] = useState("");
    const [baseImportance, setBaseImportance] = useState(50);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);
        try {
            const { data } = await api.post("/schedules", {
                title,
                description: description || undefined,
                type,
                subtype,
                start_at: new Date(startAt).toISOString(),
                end_at: endAt ? new Date(endAt).toISOString() : undefined,
                all_day: allDay,
                location: location || undefined,
                base_importance: baseImportance,
            });
            router.push(`/dashboard/schedules/${data.id}`);
        } catch {
            setError("일정 생성에 실패했습니다.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">새 일정 만들기</h1>

            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                    <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">타입</label>
                        <select
                            value={type}
                            onChange={(e) => {
                                setType(e.target.value);
                                setSubtype(SUBTYPES[e.target.value][0].value);
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        >
                            <option value="PROJECT">프로젝트</option>
                            <option value="INTERVAL">인터벌</option>
                            <option value="EVENT">이벤트</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">서브타입</label>
                        <select
                            value={subtype}
                            onChange={(e) => setSubtype(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        >
                            {SUBTYPES[type]?.map((st) => (
                                <option key={st.value} value={st.value}>
                                    {st.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">시작 시간</label>
                        <input
                            type="datetime-local"
                            required
                            value={startAt}
                            onChange={(e) => setStartAt(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">종료 시간 (선택)</label>
                        <input
                            type="datetime-local"
                            value={endAt}
                            onChange={(e) => setEndAt(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={allDay}
                            onChange={(e) => setAllDay(e.target.checked)}
                            className="rounded"
                        />
                        종일 일정
                    </label>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">장소 (선택)</label>
                    <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        기본 중요도: {baseImportance}
                    </label>
                    <input
                        type="range"
                        min={1}
                        max={100}
                        value={baseImportance}
                        onChange={(e) => setBaseImportance(Number(e.target.value))}
                        className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                        <span>낮음</span>
                        <span>높음</span>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    {submitting ? "생성 중..." : "일정 생성"}
                </button>
            </form>
        </div>
    );
}
