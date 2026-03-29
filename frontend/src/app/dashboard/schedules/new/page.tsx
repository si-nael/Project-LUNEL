"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const SUBTYPES: Record<string, { value: string; label: string }[]> = {
    project: [
        { value: "personal", label: "개인 프로젝트" },
        { value: "team", label: "팀 프로젝트" },
        { value: "temp_group", label: "임시 그룹 프로젝트" },
    ],
    interval: [
        { value: "registration", label: "접수 기간" },
        { value: "festival", label: "행사 기간" },
        { value: "submission", label: "제출 기간" },
    ],
    event: [
        { value: "competition", label: "대회" },
        { value: "assignment", label: "수행평가" },
        { value: "homework", label: "과제" },
        { value: "meeting", label: "회의" },
        { value: "general", label: "일반 행사" },
    ],
};

export default function NewSchedulePage() {
    const { user } = useAuth();
    const router = useRouter();

    const [form, setForm] = useState({
        title: "",
        description: "",
        type: "event",
        subtype: "general",
        start_time: "",
        end_time: "",
        location: "",
        importance: 5,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >
    ) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const type = e.target.value;
        const firstSubtype = SUBTYPES[type]?.[0]?.value || "";
        setForm((prev) => ({ ...prev, type, subtype: firstSubtype }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await api.post("/api/v1/schedules/", {
                ...form,
                importance: Number(form.importance),
            });
            router.push("/dashboard/schedules");
        } catch (err: unknown) {
            const axiosErr = err as {
                response?: { data?: { detail?: string } };
            };
            setError(
                axiosErr.response?.data?.detail ||
                "일정 생성에 실패했습니다."
            );
        }
        setLoading(false);
    };

    return (
        <div className="max-w-lg">
            <h1 className="text-xl font-semibold tracking-tight mb-6">
                새 일정 만들기
            </h1>

            {error && (
                <p className="text-destructive text-xs bg-destructive/8 px-3 py-2 rounded-lg mb-4">
                    {error}
                </p>
            )}

            <form onSubmit={handleSubmit} className="glass rounded-2xl p-5 space-y-4">
                <div>
                    <label className="block text-xs text-foreground/60 mb-1.5">
                        제목
                    </label>
                    <input
                        type="text"
                        name="title"
                        value={form.title}
                        onChange={handleChange}
                        required
                        className="w-full border border-border/60 bg-transparent rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40"
                    />
                </div>

                <div>
                    <label className="block text-xs text-foreground/60 mb-1.5">
                        설명
                    </label>
                    <textarea
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        rows={3}
                        className="w-full border border-border/60 bg-transparent rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring/40"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-foreground/60 mb-1.5">
                            유형
                        </label>
                        <select
                            name="type"
                            value={form.type}
                            onChange={handleTypeChange}
                            className="w-full border border-border/60 bg-transparent rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40"
                        >
                            <option value="project">프로젝트</option>
                            <option value="interval">인터벌</option>
                            <option value="event">이벤트</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-foreground/60 mb-1.5">
                            서브타입
                        </label>
                        <select
                            name="subtype"
                            value={form.subtype}
                            onChange={handleChange}
                            className="w-full border border-border/60 bg-transparent rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40"
                        >
                            {(SUBTYPES[form.type] || []).map((st) => (
                                <option key={st.value} value={st.value}>
                                    {st.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-foreground/60 mb-1.5">
                            시작 시간
                        </label>
                        <input
                            type="datetime-local"
                            name="start_time"
                            value={form.start_time}
                            onChange={handleChange}
                            required
                            className="w-full border border-border/60 bg-transparent rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-foreground/60 mb-1.5">
                            종료 시간
                        </label>
                        <input
                            type="datetime-local"
                            name="end_time"
                            value={form.end_time}
                            onChange={handleChange}
                            required
                            className="w-full border border-border/60 bg-transparent rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-foreground/60 mb-1.5">
                        장소
                    </label>
                    <input
                        type="text"
                        name="location"
                        value={form.location}
                        onChange={handleChange}
                        className="w-full border border-border/60 bg-transparent rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40"
                    />
                </div>

                <div>
                    <label className="block text-xs text-foreground/60 mb-1.5">
                        기본 중요도: {form.importance}
                    </label>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-foreground/40">
                            낮음
                        </span>
                        <input
                            type="range"
                            name="importance"
                            min="1"
                            max="10"
                            value={form.importance}
                            onChange={handleChange}
                            className="flex-1 accent-primary"
                        />
                        <span className="text-[11px] text-foreground/40">
                            높음
                        </span>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-all"
                >
                    {loading ? "생성 중..." : "일정 생성"}
                </button>
            </form>
        </div>
    );
}
