"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { ActivityNode, ActivityEdge as ApiActivityEdge } from "@/types";
import {
    ReactFlow,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    Edge,
    Node,
    MarkerType,
    Panel
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { DagNode } from "@/components/dashboard/dag-node";
import { AlertTriangle, GitBranch, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Project {
    id: string;
    title: string;
}

interface CycleCheck {
    project_id: string;
    has_cycle: boolean;
}

const nodeTypes = {
    activity: DagNode,
};

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "TB") => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 100 });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: 180, height: 80 });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = direction === "TB" ? "top" : "left" as any;
        node.sourcePosition = direction === "TB" ? "bottom" : "right" as any;
        node.position = {
            x: nodeWithPosition.x - 90,
            y: nodeWithPosition.y - 40,
        };
        return node;
    });

    return { nodes, edges };
};

export default function DAGPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<string>("");
    const [cycleCheck, setCycleCheck] = useState<CycleCheck | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    useEffect(() => {
        api.get("/projects")
            .then((res) => setProjects(res.data))
            .catch(() => { });
    }, []);

    const loadDAG = useCallback(async (projectId: string) => {
        setLoading(true);
        setError("");
        try {
            const [nodesRes, edgesRes, cycleRes] = await Promise.all([
                api.get<ActivityNode[]>(`/projects/${projectId}/nodes`),
                api.get<ApiActivityEdge[]>(`/projects/${projectId}/edges`),
                api.get<CycleCheck>(`/projects/${projectId}/dag-check`),
            ]);

            setCycleCheck(cycleRes.data);

            // Convert API nodes to React Flow nodes
            const initialNodes: Node[] = nodesRes.data.map((n) => ({
                id: n.id,
                type: "activity",
                position: { x: 0, y: 0 },
                data: n as unknown as Record<string, unknown>,
            }));

            // Convert API edges to React Flow edges
            const initialEdges: Edge[] = edgesRes.data.map((e) => ({
                id: e.id,
                source: e.from_node_id,
                target: e.to_node_id,
                type: "smoothstep",
                animated: e.edge_type === "DEPENDS_ON",
                style: { stroke: e.edge_type === "DEPENDS_ON" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: e.edge_type === "DEPENDS_ON" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                },
            }));

            // Apply dagre layout
            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                initialNodes,
                initialEdges
            );

            setNodes(layoutedNodes);
            setEdges(layoutedEdges);
        } catch {
            setError("DAG 데이터를 불러오는 데 오류가 발생했습니다.");
            setNodes([]);
            setEdges([]);
        }
        setLoading(false);
    }, [setNodes, setEdges]);

    const handleProjectSelect = (id: string) => {
        setSelectedProject(id);
        if (id) loadDAG(id);
    };

    const handleRefresh = () => {
        if (selectedProject) loadDAG(selectedProject);
    };

    const handleLayout = (direction: string) => {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            nodes,
            edges,
            direction
        );
        setNodes([...layoutedNodes]);
        setEdges([...layoutedEdges]);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 text-primary rounded-xl">
                        <GitBranch className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">DAG 시각화</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">프로젝트의 작업 흐름과 의존성을 인터랙티브하게 확인하세요.</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <select
                        value={selectedProject}
                        onChange={(e) => handleProjectSelect(e.target.value)}
                        className="border border-input bg-background rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40 w-64"
                    >
                        <option value="">프로젝트 선택...</option>
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.title}
                            </option>
                        ))}
                    </select>
                    
                    <Button variant="outline" size="icon" onClick={handleRefresh} disabled={!selectedProject || loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {error && <p className="text-destructive text-sm mb-4">{error}</p>}

            {cycleCheck && cycleCheck.has_cycle && (
                <div className="mb-4 p-3 rounded-xl text-sm bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    순환 감지됨 — 유효한 DAG가 아닙니다. 작업 의존성을 확인하세요.
                </div>
            )}

            <div className="flex-1 glass rounded-2xl overflow-hidden border border-border/50 relative">
                {!selectedProject ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                        <GitBranch className="h-12 w-12 opacity-20 mb-4" />
                        <p>위에서 프로젝트를 선택하여 DAG를 확인하세요.</p>
                    </div>
                ) : (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        nodeTypes={nodeTypes}
                        fitView
                        className="bg-foreground/[0.02]"
                    >
                        <Background gap={12} size={1} />
                        <Controls className="bg-background border-border" />
                        <Panel position="top-right" className="flex gap-2">
                            <Button size="sm" variant="secondary" onClick={() => handleLayout('TB')} className="text-xs">수직 정렬</Button>
                            <Button size="sm" variant="secondary" onClick={() => handleLayout('LR')} className="text-xs">수평 정렬</Button>
                        </Panel>
                    </ReactFlow>
                )}
            </div>
        </div>
    );
}
