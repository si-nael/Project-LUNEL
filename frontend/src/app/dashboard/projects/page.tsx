"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Project } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_LABELS: Record<string, string> = {
    DRAFT: "초안",
    ACTIVE: "진행 중",
    PAUSED: "일시정지",
    COMPLETED: "완료",
    ARCHIVED: "보관",
};

export default function ProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        api.get<Project[]>("/projects")
            .then(({ data }) => setProjects(data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-semibold tracking-tight">프로젝트</h1>
            </div>

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
