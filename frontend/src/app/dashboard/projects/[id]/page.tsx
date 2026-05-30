import DagVisualizer from "@/components/dashboard/dag-visualizer";
import { ActivityEdge } from "@/types";

// ... existing code ...

export default function ProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [project, setProject] = useState<Project | null>(null);
    const [nodes, setNodes] = useState<ActivityNode[]>([]);
    const [edges, setEdges] = useState<ActivityEdge[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTitle, setNewTitle] = useState("");
    const [newType, setNewType] = useState<"MILESTONE" | "TASK" | "SUB_TASK">("TASK");
    const [activeTab, setActiveTab] = useState<"LIST" | "DAG" | "SIMULATOR">("DAG");
    const [simData, setSimData] = useState<any>(null);
    const [simLoading, setSimLoading] = useState(false);

    useEffect(() => {
        Promise.all([
            api.get<Project>(`/projects/${id}`),
            api.get<ActivityNode[]>(`/projects/${id}/nodes`),
            api.get<ActivityEdge[]>(`/projects/${id}/edges`),
        ])
            .then(([projRes, nodesRes, edgesRes]) => {
                setProject(projRes.data);
                setNodes(nodesRes.data);
                setEdges(edgesRes.data);
            })
            .catch(() => toast.error("프로젝트를 불러올 수 없습니다."))
            .finally(() => setLoading(false));
    }, [id]);

    const runSimulation = async () => {
        setSimLoading(true);
        try {
            const { data } = await api.get(`/projects/${id}/simulate`);
            setSimData(data);
            toast.success("시뮬레이션 완료");
        } catch (err: any) {
            toast.error(err.response?.data?.detail || "시뮬레이션 실패");
        } finally {
            setSimLoading(false);
        }
    };

    // ... existing addNode, updateProgress, markDone ...

    const addNode = async () => {
        if (!newTitle.trim()) return;
        try {
            const { data } = await api.post<ActivityNode>(
                `/projects/${id}/nodes`,
                {
                    title: newTitle,
                    node_type: newType,
                    order_index: nodes.length,
                    cost_hours: 5.0,
                    success_probability: 0.8,
                    reward_points: 10.0,
                }
            );
            setNodes((prev) => [...prev, data]);
            setNewTitle("");
            toast.success("노드가 추가되었습니다.");
        } catch {
            toast.error("노드 추가에 실패했습니다.");
        }
    };

    const markDone = async (nodeId: string) => {
        try {
            const { data } = await api.patch<ActivityNode>(
                `/projects/${id}/nodes/${nodeId}`,
                { status: "DONE" }
            );
            setNodes((prev) => prev.map((n) => (n.id === nodeId ? data : n)));
            toast.success("완료 처리되었습니다.");
        } catch (err: any) {
            toast.error(err.response?.data?.detail || "상태 변경에 실패했습니다.");
        }
    };

    const rootNodes = nodes.filter((n) => !n.parent_id);
    const childrenOf = (parentId: string) => nodes.filter((n) => n.parent_id === parentId);

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
                    className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_COLORS[node.status] || ""}`}
                >
                    {STATUS_LABELS[node.status] || node.status}
                </span>
                {node.status !== "DONE" && (
                    <button
                        onClick={() => markDone(node.id)}
                        className="opacity-0 group-hover:opacity-100 text-xs text-emerald-600 hover:text-emerald-700 transition-opacity"
                    >
                        완료
                    </button>
                )}
            </div>
            {childrenOf(node.id).map((child) => renderNode(child, depth + 1))}
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
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">{project.title}</h1>
                    {project.description && (
                        <p className="text-xs text-muted-foreground mt-1">{project.description}</p>
                    )}
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setActiveTab("DAG")}
                        className={`text-xs px-3 py-1.5 rounded-full ${activeTab === "DAG" ? "bg-primary text-primary-foreground" : "bg-foreground/5 hover:bg-foreground/10"}`}
                    >
                        Quest Map (DAG)
                    </button>
                    <button 
                        onClick={() => setActiveTab("SIMULATOR")}
                        className={`text-xs px-3 py-1.5 rounded-full ${activeTab === "SIMULATOR" ? "bg-primary text-primary-foreground" : "bg-foreground/5 hover:bg-foreground/10"}`}
                    >
                        EV Simulator
                    </button>
                    <button 
                        onClick={() => setActiveTab("LIST")}
                        className={`text-xs px-3 py-1.5 rounded-full ${activeTab === "LIST" ? "bg-primary text-primary-foreground" : "bg-foreground/5 hover:bg-foreground/10"}`}
                    >
                        List View
                    </button>
                </div>
            </div>

            {activeTab === "DAG" && (
                <div className="animate-fade-in">
                    <div className="mb-4">
                        <DagVisualizer nodes={nodes} edges={edges} />
                    </div>
                </div>
            )}

            {activeTab === "SIMULATOR" && (
                <div className="animate-fade-in space-y-4">
                    <div className="glass rounded-2xl p-6 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-semibold text-sm">몬테카를로/다이나믹 EV 시뮬레이션</h3>
                                <p className="text-xs text-muted-foreground">현재 구성된 퀘스트 트리의 수학적 성공 기댓값과 최적 경로 비용을 산출합니다.</p>
                            </div>
                            <button 
                                onClick={runSimulation}
                                disabled={simLoading}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50"
                            >
                                {simLoading ? "계산 중..." : "Run Simulation"}
                            </button>
                        </div>

                        {simData && (
                            <div className="mt-4 grid grid-cols-2 gap-4">
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                                    <div className="text-xs font-medium text-emerald-600 mb-1">총 예상 리워드 (EV)</div>
                                    <div className="text-2xl font-bold text-emerald-700">{simData.total_expected_reward} pts</div>
                                </div>
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                                    <div className="text-xs font-medium text-amber-600 mb-1">총 예상 소요 시간 (Cost)</div>
                                    <div className="text-2xl font-bold text-amber-700">{simData.total_expected_cost} hrs</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === "LIST" && (
                <div className="animate-fade-in space-y-4">
                    <div className="glass rounded-2xl p-4">
                        <div className="flex gap-2">
                            <select
                                value={newType}
                                onChange={(e) => setNewType(e.target.value as any)}
                                className="text-sm border border-border/60 bg-transparent rounded-xl px-3 py-2 focus:outline-none"
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
                                className="flex-1 text-sm border border-border/60 bg-transparent rounded-xl px-3 py-2 focus:outline-none"
                                onKeyDown={(e) => e.key === "Enter" && addNode()}
                            />
                            <button onClick={addNode} className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-xl">
                                추가
                            </button>
                        </div>
                    </div>
                    <div className="glass rounded-2xl p-4">
                        {nodes.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-8">아직 작업 노드가 없습니다.</p>
                        ) : (
                            rootNodes.map((node) => renderNode(node))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
