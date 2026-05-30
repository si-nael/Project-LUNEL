"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import VisibilityEditor from "@/components/dashboard/visibility-editor";

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

    const [form, setForm] = useState({
        title: "",
        description: "",
        type: "EVENT",
        subtype: "GENERAL_EVENT",
        start_at: "",
        end_at: "",
        location: "",
        base_importance: 50,
        visibility_policy_id: "",
    });
    const [loading, setLoading] = useState(false);

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
        try {
            await api.post("/schedules", {
                title: form.title,
                description: form.description || null,
                type: form.type,
                subtype: form.subtype,
                start_at: new Date(form.start_at).toISOString(),
                end_at: form.end_at
                    ? new Date(form.end_at).toISOString()
                    : null,
                location: form.location || null,
                base_importance: Number(form.base_importance),
                visibility_policy_id: form.visibility_policy_id || null,
            });
            toast.success("일정이 생성되었습니다.");
            router.push("/dashboard/schedules");
        } catch (err: unknown) {
            const axiosErr = err as {
                response?: { data?: { detail?: string } };
            };
            toast.error(
                axiosErr.response?.data?.detail || "일정 생성에 실패했습니다."
            );
        }
        setLoading(false);
    };

    return (
        <div className="max-w-lg">
            <div className="flex items-center gap-3 mb-6">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/schedules">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-xl font-semibold tracking-tight">
                    새 일정 만들기
                </h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">일정 정보</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1.5">
                            <Label htmlFor="title">제목</Label>
                            <Input
                                id="title"
                                name="title"
                                value={form.title}
                                onChange={handleChange}
                                required
                                placeholder="일정 제목을 입력하세요"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="description">설명</Label>
                            <textarea
                                id="description"
                                name="description"
                                value={form.description}
                                onChange={handleChange}
                                rows={3}
                                placeholder="선택사항"
                                className="flex w-full rounded-xl bg-transparent px-3 py-2 text-sm border border-border transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-primary/40 resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="type">유형</Label>
                                <select
                                    id="type"
                                    name="type"
                                    value={form.type}
                                    onChange={handleTypeChange}
                                    className="flex h-9 w-full rounded-xl bg-transparent px-3 py-2 text-sm border border-border transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                                >
                                    <option value="PROJECT">프로젝트</option>
                                    <option value="INTERVAL">인터벌</option>
                                    <option value="EVENT">이벤트</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="subtype">서브타입</Label>
                                <select
                                    id="subtype"
                                    name="subtype"
                                    value={form.subtype}
                                    onChange={handleChange}
                                    className="flex h-9 w-full rounded-xl bg-transparent px-3 py-2 text-sm border border-border transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
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
                            <div className="space-y-1.5">
                                <Label htmlFor="start_at">시작 시간</Label>
                                <Input
                                    id="start_at"
                                    type="datetime-local"
                                    name="start_at"
                                    value={form.start_at}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="end_at">종료 시간</Label>
                                <Input
                                    id="end_at"
                                    type="datetime-local"
                                    name="end_at"
                                    value={form.end_at}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="location">장소</Label>
                            <Input
                                id="location"
                                name="location"
                                value={form.location}
                                onChange={handleChange}
                                placeholder="선택사항"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>
                                기본 중요도:{" "}
                                <span className="text-primary font-semibold">
                                    {form.base_importance}
                                </span>
                            </Label>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">
                                    1
                                </span>
                                <input
                                    type="range"
                                    name="base_importance"
                                    min="1"
                                    max="100"
                                    value={form.base_importance}
                                    onChange={handleChange}
                                    className="flex-1 accent-primary"
                                />
                                <span className="text-xs text-muted-foreground">
                                    100
                                </span>
                            </div>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-border/40">
                            <Label>접근 정책 (선택)</Label>
                            <VisibilityEditor
                                value={form.visibility_policy_id}
                                onChange={(policyId) => setForm(prev => ({ ...prev, visibility_policy_id: policyId || "" }))}
                                targetType="schedule"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full"
                        >
                            {loading ? "생성 중..." : "일정 생성"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
