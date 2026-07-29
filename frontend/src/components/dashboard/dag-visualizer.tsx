"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ReactFlow,
    Controls,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    NodeChange,
    EdgeChange,
    Node as FlowNode,
    Edge as FlowEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { ActivityNode, ActivityEdge } from "@/types";

interface DagVisualizerProps {
    nodes: ActivityNode[];
    edges: ActivityEdge[];
}

const nodeWidth = 220;
const nodeHeight = 80;

const getLayoutedElements = (
    nodes: FlowNode[],
    edges: FlowEdge[],
    direction = "LR"
) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = direction === "LR" ? "left" : "top" as any;
        node.sourcePosition = direction === "LR" ? "right" : "bottom" as any;

        // Shift dagre's center anchor to top-left
        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        };
        return node;
    });

    return { nodes, edges };
};

export default function DagVisualizer({ nodes: activityNodes, edges: activityEdges }: DagVisualizerProps) {
    const initialNodes: FlowNode[] = useMemo(() => {
        return activityNodes.map((an) => ({
            id: an.id,
            position: { x: 0, y: 0 },
            data: {
                label: (
                    <div className="flex flex-col text-left p-2 h-full justify-center">
                        <div className="font-semibold text-xs mb-1 truncate">{an.title}</div>
                        <div className="text-[10px] text-muted-foreground flex justify-between">
                            <span>Cost: {an.cost_hours}h</span>
                            <span>Win%: {Math.round(an.success_probability * 100)}%</span>
                        </div>
                        <div className="text-[10px] text-primary font-medium mt-1">
                            Reward: {an.reward_points} pts
                        </div>
                        <div className="absolute top-1 right-1">
                            <span className={`w-2 h-2 rounded-full inline-block ${an.status === 'DONE' ? 'bg-emerald-500' : an.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-foreground/20'}`} />
                        </div>
                    </div>
                ),
            },
            style: {
                width: nodeWidth,
                height: nodeHeight,
                background: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "12px",
                padding: 0,
                opacity: an.status === "BLOCKED" ? 0.55 : 1,
            },
        }));
    }, [activityNodes]);

    const initialEdges: FlowEdge[] = useMemo(() => {
        return activityEdges.map((ae) => ({
            id: ae.id,
            source: ae.from_node_id,
            target: ae.to_node_id,
            type: "smoothstep",
            animated: ae.edge_type === "DEPENDS_ON",
            style: { stroke: "hsl(var(--primary))" },
        }));
    }, [activityEdges]);

    const [nodes, setNodes] = useState<FlowNode[]>([]);
    const [edges, setEdges] = useState<FlowEdge[]>([]);

    useEffect(() => {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            initialNodes,
            initialEdges,
            "LR" // Left to Right
        );
        setNodes([...layoutedNodes]);
        setEdges([...layoutedEdges]);
    }, [initialNodes, initialEdges]);

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    );
    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    );

    return (
        <div style={{ width: "100%", height: "500px" }} className="border border-border/50 rounded-2xl overflow-hidden glass">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                className="bg-foreground/[0.01]"
            >
                <Controls className="bg-background border-border text-foreground fill-foreground" />
                <Background color="hsl(var(--foreground))" gap={16} size={1} />
            </ReactFlow>
        </div>
    );
}
