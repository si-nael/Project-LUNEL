"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Project, ActivityNode } from "@/types";

const STATUS_LABELS: Record<string, string> = {
    PENDING: "대기",
    IN_PROGRESS: "진행 중",
    DONE: "완료",
    BLOCKED: "차단됨",
};

const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-foreground/[0.06] text-foreground/60",
    IN_PROGRESS: "bg-blue-500/10 text-blue-600",
    DONE: "bg-emerald-500/10 text-emerald-600",
    BLOCKED: "bg-red-500/10 text-red-600",
};

const NODE_ICONS: Record<string, string> = {
    MILESTONE: "🎯",
    TASK: "📌",
    SUB_TASK: "▫️",
};

export default function ProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [project, setProject] = useState<Project | null>(null);
    const [nodes, setNodes] = useState<ActivityNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTitle, setNewTitle] = useState("");
    const [newType, setNewType] = useState<"MILESTONE" | "TASK" | "SUB_TASK">(
        "TASK"
    );

    useEffect(() => {
        Promise.all([
            api.get<Project>(`/projects/${id}`),
            api.get<ActivityNode[]>(`/projects/${id}/nodes`),
        ])
            .then(([projRes, nodesRes]) => {
                setProject(projRes.data);
                setNodes(nodesRes.data);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [id]);

    const addNode = async () => {
        if (!newTitle.trim()) return;
        const { data } = await api.post<ActivityNode>(
            `/projects/${id}/nodes`,
            {
                title: newTitle,
                node_type: newType,
                order_index: nodes.length,
            }
        );
        setNodes((prev) => [...prev, data]);
        setNewTitle("");
    };

    const updateProgress = async (nodeId: string, progress: number) => {
        const { data } = await api.patch<ActivityNode>(
            `/projects/${id}/nodes/${nodeId}`,
            { progress }
        );
        setNodes((prev) => prev.map((n) => (n.id === nodeId ? data : n)));
    };

    const markDone = async (nodeId: string) => {
        const { data } = await api.patch<ActivityNode>(
            `/projects/${id}/nodes/${nodeId}`,
            { status: "DONE" }
        );
        setNodes((prev) => prev.map((n) => (n.id === nodeId ? data : n)));
    };

    // Build tree structure
    const rootNodes = nodes.filter((n) => !n.parent_id);
    const childrenOf = (parentId: string) =>
        nodes.filter((n) => n.parent_id === parentId);

    const renderNode = (node: ActivityNode, depth: number = 0) => (
        <div key={node.id} style={{ marginLeft: depth * 24 }}>
            <div className="flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-foreground/[0.02] group transition-all">
                <span className="text-sm">
                    {NODE_ICONS[node.node_type] || "📌"}
                </span>
                <span className="text-sm font-medium text-foreground flex-1">
                    {node.title}
                </span>
                <span
                    className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_COLORS[node.status] || ""
                        }`}
                >
                    {STATUS_LABELS[node.status] || node.status}
                </span>
                <div className="flex items-center gap-1">
                    <div className="w-16 bg-foreground/[0.04] rounded-full h-1.5">
                        <div
                            className="bg-primary/70 h-1.5 rounded-full transition-all"
                            style={{ width: `${node.progress}%` }}
                        />
                    </div>
                    <span className="text-[11px] text-foreground/40 w-8 text-right">
                        {node.progress}%
                    </span>
                </div>
                {node.status !== "DONE" && (
                    <button
                        onClick={() => markDone(node.id)}
                        className="opacity-0 group-hover:opacity-100 text-xs text-emerald-600 hover:text-emerald-700 transition-opacity"
                    >
                        완료
                    </button>
                )}
            </div>
            {childrenOf(node.id).map((child) =>
                renderNode(child, depth + 1)
            )}
        </div>
    );

    if (loading)
        return (
            <div className="flex justify-center py-20">
                <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            </div>
        );
    if (!project) return <p className="text-destructive text-sm">프로젝트를 찾을 수 없습니다.</p>;

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-xl font-semibold tracking-tight">
                    {project.title}
                </h1>
                {project.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                        {project.description}
                    </p>
                )}
                <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-2">
                        <div className="w-32 bg-foreground/[0.04] rounded-full h-1.5">
                            <div
                                className="bg-primary/70 h-1.5 rounded-full transition-all"
                                style={{
                                    width: `${project.progress_percent}%`,
                                }}
                            />
                        </div>
                        <span className="text-xs font-medium text-foreground/60">
                            {project.progress_percent}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Add node form */}
            <div className="glass rounded-2xl p-4 mb-4">
                <div className="flex gap-2">
                    <select
                        value={newType}
                        onChange={(e) =>
                            setNewType(
                                e.target.value as
                                | "MILESTONE"
                                | "TASK"
                                | "SUB_TASK"
                            )
                        }
                        className="text-sm border border-border/60 bg-transparent rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring/40"
                    >
                        <option value="MILESTONE">🎯 마일스톤</option>
                        <option value="TASK">📌 태스크</option>
                        <option value="SUB_TASK">▫️ 서브태스크</option>
                    </select>
                    <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="새 노드 이름"
                        className="flex-1 text-sm border border-border/60 bg-transparent rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring/40"
                        onKeyDown={(e) =>
                            e.key === "Enter" && addNode()
                        }
                    />
                    <button
                        onClick={addNode}
                        className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all"
                    >
                        추가
                    </button>
                </div>
            </div>

            {/* Task tree */}
            <div className="glass rounded-2xl p-4">
                {nodes.length === 0 ? (
                    <p className="text-xs text-foreground/40 text-center py-8">
                        아직 작업 노드가 없습니다. 위에서 추가해 보세요.
                    </p>
                ) : (
                    rootNodes.map((node) => renderNode(node))
                )}
            </div>
        </div>
    );
}
