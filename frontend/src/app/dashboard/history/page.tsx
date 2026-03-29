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
        api.get("/api/v1/schedules").then((res) => setSchedules(res.data));
        api.get("/api/v1/projects").then((res) => setProjects(res.data));
    }, []);

    const loadHistory = async (id: string) => {
        setLoading(true);
        try {
            const endpoint = mode === "schedule"
                ? `/api/v1/schedules/${id}/history`
                : `/api/v1/projects/${id}/history`;
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
        CREATE: "bg-green-100 text-green-800",
        UPDATE: "bg-yellow-100 text-yellow-800",
        DELETE: "bg-red-100 text-red-800",
    };

    const items = mode === "schedule" ? schedules : projects;

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">변경 이력</h1>

            <div className="flex gap-4 mb-6">
                <div className="flex rounded-lg overflow-hidden border border-gray-300">
                    <button
                        onClick={() => { setMode("schedule"); setSelectedId(""); setHistory([]); }}
                        className={`px-4 py-2 text-sm ${mode === "schedule" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                    >
                        일정
                    </button>
                    <button
                        onClick={() => { setMode("project"); setSelectedId(""); setHistory([]); }}
                        className={`px-4 py-2 text-sm ${mode === "project" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                    >
                        프로젝트
                    </button>
                </div>

                <select
                    value={selectedId}
                    onChange={(e) => handleSelect(e.target.value)}
                    className="border border-gray-300 rounded-lg px-4 py-2 text-sm flex-1"
                >
                    <option value="">{mode === "schedule" ? "일정" : "프로젝트"} 선택...</option>
                    {items.map((item) => (
                        <option key={item.id} value={item.id}>{item.title}</option>
                    ))}
                </select>
            </div>

            {loading && <p className="text-gray-500">로딩 중...</p>}

            {history.length > 0 && (
                <div className="space-y-4">
                    {history.map((entry) => (
                        <div key={entry.id} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-3 mb-3">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${changeTypeColors[entry.change_type] || "bg-gray-100"}`}>
                                    {entry.change_type}
                                </span>
                                <span className="text-sm text-gray-500">
                                    {new Date(entry.changed_at).toLocaleString("ko-KR")}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                {entry.previous_data && (
                                    <div>
                                        <h4 className="font-medium text-gray-500 mb-1">이전</h4>
                                        <pre className="bg-red-50 p-2 rounded text-xs overflow-auto max-h-40">
                                            {JSON.stringify(entry.previous_data, null, 2)}
                                        </pre>
                                    </div>
                                )}
                                {entry.new_data && (
                                    <div>
                                        <h4 className="font-medium text-gray-500 mb-1">이후</h4>
                                        <pre className="bg-green-50 p-2 rounded text-xs overflow-auto max-h-40">
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
                <p className="text-gray-500">변경 이력이 없습니다.</p>
            )}
        </div>
    );
}
