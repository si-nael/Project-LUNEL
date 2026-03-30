"use client";

import { useEffect, useState, FormEvent } from "react";
import { api } from "@/lib/api";
import { Group } from "@/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

const TYPE_LABELS: Record<string, string> = {
    SCHOOL: "학교",
    GRADE: "학년",
    CLASS: "반",
    CLUB: "동아리",
    PROJECT_TEAM: "프로젝트 팀",
    TEMPORARY: "임시",
    STAFF: "교직원",
};

export default function GroupsPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    const [name, setName] = useState("");
    const [type, setType] = useState("CLUB");
    const [isTemporary, setIsTemporary] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const fetchGroups = () => {
        api.get<Group[]>("/groups")
            .then(({ data }) => setGroups(data))
            .catch(() => toast.error("그룹 목록을 불러올 수 없습니다."))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    const handleCreate = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post("/groups", { name, type, is_temporary: isTemporary });
            setShowForm(false);
            setName("");
            fetchGroups();
        } catch {
            toast.error("그룹 생성에 실패했습니다.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-semibold tracking-tight">그룹</h1>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="text-xs px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                >
                    {showForm ? "취소" : "+ 새 그룹"}
                </button>
            </div>

            {showForm && (
                <form
                    onSubmit={handleCreate}
                    className="glass rounded-2xl p-5 mb-6 space-y-4"
                >
                    <div>
                        <Label htmlFor="group-name" className="text-xs mb-1">
                            그룹명
                        </Label>
                        <Input
                            id="group-name"
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="group-type" className="text-xs mb-1">
                                유형
                            </Label>
                            <select
                                id="group-type"
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full border border-border bg-transparent rounded-xl px-3 py-2 text-sm"
                            >
                                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                                    <option key={v} value={v}>
                                        {l}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center gap-2 text-xs pb-2">
                                <input
                                    type="checkbox"
                                    checked={isTemporary}
                                    onChange={(e) => setIsTemporary(e.target.checked)}
                                    className="rounded"
                                />
                                임시 그룹
                            </label>
                        </div>
                    </div>
                    <Button
                        type="submit"
                        disabled={submitting}
                        size="sm"
                    >
                        생성
                    </Button>
                </form>
            )}

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
            ) : groups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-20">
                    그룹이 없습니다.
                </p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groups.map((g) => (
                        <Link key={g.id} href={`/dashboard/groups/${g.id}`} className="block">
                            <div className="glass rounded-2xl p-5 hover:bg-foreground/[0.02] transition-all cursor-pointer">
                                <div className="flex items-start justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-foreground">
                                        {g.name}
                                    </h3>
                                    {g.is_temporary && (
                                        <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-full">
                                            임시
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="px-2 py-0.5 bg-foreground/[0.04] rounded-full text-[11px]">
                                        {TYPE_LABELS[g.type] || g.type}
                                    </span>
                                    <span>멤버 {g.member_count}명</span>
                                </div>
                                {g.expires_at && (
                                    <div className="text-[11px] text-destructive mt-2">
                                        만료:{" "}
                                        {new Date(g.expires_at).toLocaleDateString("ko-KR")}
                                    </div>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
