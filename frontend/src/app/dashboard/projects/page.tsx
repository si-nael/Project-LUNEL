"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Project } from "@/types";

const STATUS_LABELS: Record<string, string> = {
    DRAFT: "초안",
    ACTIVE: "진행 중",
    PAUSED: "일시정지",
    COMPLETED: "완료",
    ARCHIVED: "보관",
};

const STATUS_COLORS: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-600",
    ACTIVE: "bg-green-100 text-green-700",
    PAUSED: "bg-yellow-100 text-yellow-700",
    COMPLETED: "bg-blue-100 text-blue-700",
    ARCHIVED: "bg-gray-100 text-gray-500",
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
                <h1 className="text-2xl font-bold text-gray-900">프로젝트</h1>
            </div>

            {loading ? (
                <p className="text-gray-400">로딩 중...</p>
            ) : projects.length === 0 ? (
                <p className="text-gray-400">프로젝트가 없습니다.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.map((p) => (
                        <div
                            key={p.id}
                            className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-blue-300 transition-colors"
                            onClick={() => router.push(`/dashboard/projects/${p.id}`)}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <h3 className="font-semibold text-gray-900 truncate flex-1">{p.title}</h3>
                                <span className={`text-xs px-2 py-0.5 rounded ml-2 ${STATUS_COLORS[p.status] || ""}`}>
                                    {STATUS_LABELS[p.status] || p.status}
                                </span>
                            </div>

                            {p.description && (
                                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{p.description}</p>
                            )}

                            {/* Progress bar */}
                            <div className="mb-2">
                                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                    <span>진행률</span>
                                    <span className="font-medium">{p.progress_percent}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div
                                        className={`rounded-full h-2 transition-all ${p.progress_percent === 100
                                            ? "bg-green-500"
                                            : p.progress_percent >= 50
                                                ? "bg-blue-500"
                                                : "bg-orange-400"
                                            }`}
                                        style={{ width: `${p.progress_percent}%` }}
                                    />
                                </div>
                            </div>

                            <div className="text-xs text-gray-400">
                                생성: {new Date(p.created_at).toLocaleDateString("ko-KR")}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
