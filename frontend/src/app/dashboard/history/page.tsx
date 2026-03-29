"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

interface HistoryEntry {
    id: string;
    changed_by: string;
    change_type: string;
    previous_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
    changed_at: string;
    schedule_id?: string;
    project_id?: string;
}

interface Schedule {
    id: string;
    title: string;
}

interface Project {
    id: string;
    title: string;
}

export default function HistoryPage() {
    const { user } = useAuth();
    const [mode, setMode] = useState<"schedule" | "project">("schedule");
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedId, setSelectedId] = useState("");
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get("/schedules").then((res) => setSchedules(res.data)).catch(() => { });
        api.get("/projects").then((res) => setProjects(res.data)).catch(() => { });
    }, []);

    const loadHistory = async (id: string) => {
        setLoading(true);
        try {
            const endpoint =
                mode === "schedule"
                    ? `/schedules/${id}/history`
                    : `/projects/${id}/history`;
            const res = await api.get(endpoint);
            setHistory(res.data);
        } catch {
            setHistory([]);
        }
        setLoading(false);
    };

    const handleSelect = (id: string) => {
        setSelectedId(id);
        if (id) loadHistory(id);
    };

    const changeTypeColors: Record<string, string> = {
        CREATE: "bg-emerald-500/10 text-emerald-600",
        UPDATE: "bg-amber-500/10 text-amber-600",
        DELETE: "bg-destructive/10 text-destructive",
    };

    const items = mode === "schedule" ? schedules : projects;

    return (
        <div>
            <h1 className="text-xl font-semibold tracking-tight mb-6">변경 이력</h1>

            <div className="flex gap-4 mb-6">
                <div className="flex rounded-xl overflow-hidden border border-border/60">
                    <button
                        onClick={() => {
                            setMode("schedule");
                            setSelectedId("");
                            setHistory([]);
                        }}
                        className={`px-4 py-1.5 text-xs transition-all ${mode === "schedule"
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground/60 hover:text-foreground"
                            }`}
                    >
                        일정
                    </button>
                    <button
                        onClick={() => {
                            setMode("project");
                            setSelectedId("");
                            setHistory([]);
                        }}
                        className={`px-4 py-1.5 text-xs transition-all ${mode === "project"
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground/60 hover:text-foreground"
                            }`}
                    >
                        프로젝트
                    </button>
                </div>

                <select
                    value={selectedId}
                    onChange={(e) => handleSelect(e.target.value)}
                    className="border border-border/60 bg-transparent rounded-xl px-4 py-1.5 text-xs flex-1 focus:outline-none focus:ring-1 focus:ring-ring/40"
                >
                    <option value="">
                        {mode === "schedule" ? "일정" : "프로젝트"} 선택...
                    </option>
                    {items.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.title}
                        </option>
                    ))}
                </select>
            </div>

            {loading && (
                <div className="flex justify-center py-10">
                    <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
            )}

            {history.length > 0 && (
                <div className="space-y-3">
                    {history.map((entry) => (
                        <div
                            key={entry.id}
                            className="glass rounded-2xl p-4"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <span
                                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${changeTypeColors[entry.change_type] || "bg-foreground/[0.04]"
                                        }`}
                                >
                                    {entry.change_type}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {new Date(entry.changed_at).toLocaleString("ko-KR")}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                {entry.previous_data && (
                                    <div>
                                        <h4 className="text-xs font-medium text-muted-foreground mb-1">
                                            이전
                                        </h4>
                                        <pre className="bg-destructive/5 p-2 rounded-lg text-[11px] overflow-auto max-h-40">
                                            {JSON.stringify(entry.previous_data, null, 2)}
                                        </pre>
                                    </div>
                                )}
                                {entry.new_data && (
                                    <div>
                                        <h4 className="text-xs font-medium text-muted-foreground mb-1">
                                            이후
                                        </h4>
                                        <pre className="bg-emerald-500/5 p-2 rounded-lg text-[11px] overflow-auto max-h-40">
                                            {JSON.stringify(entry.new_data, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedId && !loading && history.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-10">
                    변경 이력이 없습니다.
                </p>
            )}
        </div>
    );
}
