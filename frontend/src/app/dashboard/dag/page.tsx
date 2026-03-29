"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

interface Project {
    id: string;
    title: string;
}

interface DAGOrder {
    project_id: string;
    ordered_node_ids: string[];
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
            setError("DAG 데이터를 불러오는 중 오류가 발생했습니다.");
        }
        setLoading(false);
    };

    const handleProjectSelect = (id: string) => {
        setSelectedProject(id);
        if (id) loadDAG(id);
    };

    const statusColors: Record<string, string> = {
        TODO: "bg-gray-100 text-gray-700",
        IN_PROGRESS: "bg-blue-100 text-blue-700",
        DONE: "bg-green-100 text-green-700",
        BLOCKED: "bg-red-100 text-red-700",
    };

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">DAG 시각화</h1>

            <div className="mb-6">
                <select
                    value={selectedProject}
                    onChange={(e) => handleProjectSelect(e.target.value)}
                    className="border border-gray-300 rounded-lg px-4 py-2 text-sm"
                >
                    <option value="">프로젝트 선택...</option>
                    {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                </select>
            </div>

            {loading && <p className="text-gray-500">로딩 중...</p>}
            {error && <p className="text-red-500">{error}</p>}

            {cycleCheck && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${cycleCheck.has_cycle ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                    {cycleCheck.has_cycle ? "⚠️ 순환 감지됨 — DAG가 아닙니다." : "✅ 순환 없음 — 유효한 DAG입니다."}
                </div>
            )}

            {layers && layers.layers.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-800">레이어 뷰</h2>
                    {layers.layers.map((layer, idx) => (
                        <div key={idx} className="flex items-start gap-4">
                            <div className="w-20 text-sm text-gray-500 font-medium pt-2">
                                Layer {idx}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {layer.map((nodeId) => {
                                    const node = nodeMap.get(nodeId);
                                    return (
                                        <div
                                            key={nodeId}
                                            className={`px-3 py-2 rounded-lg border text-sm ${statusColors[node?.status || "TODO"] || "bg-gray-50"}`}
                                        >
                                            <div className="font-medium">{node?.title || nodeId.slice(0, 8)}</div>
                                            <div className="text-xs mt-1 opacity-75">
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
                <p className="text-gray-500">이 프로젝트에 노드가 없습니다.</p>
            )}
        </div>
    );
}
