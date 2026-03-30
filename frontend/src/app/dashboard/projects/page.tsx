"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Project, Group } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
    DRAFT: "초안",
    ACTIVE: "진행 중",
    PAUSED: "일시정지",
    COMPLETED: "완료",
    ARCHIVED: "보관",
};

export default function ProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [groupId, setGroupId] = useState("");
    const router = useRouter();

    useEffect(() => {
        Promise.all([
            api.get<Project[]>("/projects"),
            api.get<Group[]>("/groups"),
        ])
            .then(([pRes, gRes]) => {
                setProjects(pRes.data);
                setGroups(gRes.data);
            })
            .catch(() => toast.error("데이터를 불러올 수 없습니다."))
            .finally(() => setLoading(false));
    }, []);

    const handleCreate = async () => {
        if (!title.trim() || !groupId) {
            toast.error("프로젝트 이름과 소속 그룹은 필수입니다.");
            return;
        }
        setCreating(true);
        try {
            const { data } = await api.post<Project>("/projects", {
                title,
                description: description || undefined,
                owner_group_id: groupId,
            });
            setProjects((prev) => [data, ...prev]);
            setShowCreate(false);
            setTitle("");
            setDescription("");
            toast.success("프로젝트가 생성되었습니다.");
            router.push(`/dashboard/projects/${data.id}`);
        } catch {
            toast.error("프로젝트 생성에 실패했습니다.");
        }
        setCreating(false);
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-semibold tracking-tight">프로젝트</h1>
                <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
                    {showCreate ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    {showCreate ? "취소" : "새 프로젝트"}
                </Button>
            </div>

            {/* Create form */}
            {showCreate && (
                <Card className="mb-6">
                    <CardContent className="pt-5 space-y-4">
                        <div>
                            <Label htmlFor="proj-title" className="text-xs mb-1">프로젝트 이름</Label>
                            <Input
                                id="proj-title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="예: 과학 탐구 보고서"
                            />
                        </div>
                        <div>
                            <Label htmlFor="proj-desc" className="text-xs mb-1">설명 (선택)</Label>
                            <textarea
                                id="proj-desc"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                        </div>
                        <div>
                            <Label htmlFor="proj-group" className="text-xs mb-1">소속 그룹</Label>
                            {groups.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                    그룹이 없습니다. 먼저{" "}
                                    <a href="/dashboard/groups" className="text-primary underline">그룹을 만드세요</a>.
                                </p>
                            ) : (
                                <select
                                    id="proj-group"
                                    value={groupId}
                                    onChange={(e) => setGroupId(e.target.value)}
                                    className="w-full border border-input bg-background rounded-md px-3 py-2 text-sm"
                                >
                                    <option value="">그룹 선택</option>
                                    {groups.map((g) => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <Button onClick={handleCreate} disabled={creating} size="sm">
                            {creating ? "생성 중..." : "프로젝트 생성"}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
            ) : projects.length === 0 ? (
                <p className="text-muted-foreground text-center py-20">프로젝트가 없습니다.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.map((p) => (
                        <Card
                            key={p.id}
                            className="cursor-pointer hover:bg-foreground/[0.02] transition-all duration-200"
                            onClick={() => router.push(`/dashboard/projects/${p.id}`)}
                        >
                            <CardContent className="pt-5">
                                <div className="flex items-start justify-between mb-3">
                                    <h3 className="font-semibold truncate flex-1">{p.title}</h3>
                                    <Badge variant={p.status === 'ACTIVE' ? 'default' : 'secondary'} className="ml-2">
                                        {STATUS_LABELS[p.status] || p.status}
                                    </Badge>
                                </div>

                                {p.description && (
                                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{p.description}</p>
                                )}

                                <div className="mb-2">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                        <span>진행률</span>
                                        <span className="font-medium">{p.progress_percent}%</span>
                                    </div>
                                    <div className="w-full bg-foreground/[0.04] rounded-full h-1.5">
                                        <div
                                            className={`rounded-full h-1.5 transition-all ${p.progress_percent === 100
                                                ? "bg-emerald-500"
                                                : p.progress_percent >= 50
                                                    ? "bg-primary"
                                                    : "bg-amber-500"
                                                }`}
                                            style={{ width: `${p.progress_percent}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="text-xs text-muted-foreground">
                                    생성: {new Date(p.created_at).toLocaleDateString("ko-KR")}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
