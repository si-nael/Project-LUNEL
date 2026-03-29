"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

interface Project {
    id: string;
    title: string;
}

interface DAGLayers {
    project_id: string;
    layers: string[][];
}

interface CycleCheck {
    project_id: string;
    has_cycle: boolean;
}

interface ActivityNode {
    id: string;
    title: string;
    status: string;
    node_type: string;
    progress: number;
}

export default function DAGPage() {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<string>("");
    const [nodes, setNodes] = useState<ActivityNode[]>([]);
    const [layers, setLayers] = useState<DAGLayers | null>(null);
    const [cycleCheck, setCycleCheck] = useState<CycleCheck | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        api.get("/api/v1/projects").then((res) => setProjects(res.data));
    }, []);

    const loadDAG = async (projectId: string) => {
        setLoading(true);
        setError("");
        try {
            const [nodesRes, layersRes, cycleRes] = await Promise.all([
                api.get(`/api/v1/projects/${projectId}/nodes`),
                api.get(`/api/v1/projects/${projectId}/dag-layers`).catch(() => null),
                api.get(`/api/v1/projects/${projectId}/dag-check`),
            ]);
            setNodes(nodesRes.data);
            setLayers(layersRes?.data || null);
            setCycleCheck(cycleRes.data);
        } catch {
            setError("DAG 데이터를 불러오는 데 오류가 발생했습니다.");
        }
        setLoading(false);
    };

    const handleProjectSelect = (id: string) => {
        setSelectedProject(id);
        if (id) loadDAG(id);
    };

    const statusColors: Record<string, string> = {
        TODO: "bg-foreground/[0.04] text-foreground/70",
        IN_PROGRESS: "bg-primary/8 text-primary",
        DONE: "bg-emerald-500/8 text-emerald-600",
        BLOCKED: "bg-destructive/8 text-destructive",
    };

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    return (
        <div>
            <h1 className="text-xl font-semibold tracking-tight mb-6">
                DAG 시각화
            </h1>

            <div className="mb-6">
                <select
                    value={selectedProject}
                    onChange={(e) => handleProjectSelect(e.target.value)}
                    className="border border-border/60 bg-transparent rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring/40"
                >
                    <option value="">프로젝트 선택...</option>
                    {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.title}
                        </option>
                    ))}
                </select>
            </div>

            {loading && (
                <div className="flex justify-center py-10">
                    <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
            )}
            {error && <p className="text-destructive text-xs mb-4">{error}</p>}

            {cycleCheck && (
                <div
                    className={`mb-4 p-3 rounded-xl text-xs ${cycleCheck.has_cycle
                            ? "bg-destructive/8 text-destructive"
                            : "bg-emerald-500/5 text-emerald-600"
                        }`}
                >
                    {cycleCheck.has_cycle
                        ? "순환 감지됨 — DAG가 아닙니다."
                        : "순환 없음 — 유효한 DAG입니다."}
                </div>
            )}

            {layers && layers.layers.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-sm font-semibold text-foreground">레이어별</h2>
                    {layers.layers.map((layer, idx) => (
                        <div key={idx} className="flex items-start gap-4">
                            <div className="w-16 text-xs text-muted-foreground font-medium pt-2">
                                Layer {idx}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {layer.map((nodeId) => {
                                    const node = nodeMap.get(nodeId);
                                    return (
                                        <div
                                            key={nodeId}
                                            className={`px-3 py-2 rounded-xl text-xs ${statusColors[node?.status || "TODO"] ||
                                                "bg-foreground/[0.04]"
                                                }`}
                                        >
                                            <div className="font-medium">
                                                {node?.title || nodeId.slice(0, 8)}
                                            </div>
                                            <div className="text-[10px] mt-0.5 opacity-60">
                                                {node?.node_type} · {node?.progress}%
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedProject && !loading && nodes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-10">
                    이 프로젝트에 노드가 없습니다.
                </p>
            )}
        </div>
    );
}
