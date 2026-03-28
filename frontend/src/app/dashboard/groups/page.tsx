"use client";

import { useEffect, useState, FormEvent } from "react";
import { api } from "@/lib/api";
import { Group } from "@/types";

const TYPE_LABELS: Record<string, string> = {
    SCHOOL: "학교",
    GRADE: "학년",
    CLASS: "반",
    CLUB: "동아리",
    PROJECT_TEAM: "프로젝트 팀",
    TEMPORARY: "임시",
    STAFF: "교직원",
};

export default function GroupsPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Form
    const [name, setName] = useState("");
    const [type, setType] = useState("CLUB");
    const [isTemporary, setIsTemporary] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const fetchGroups = () => {
        api.get<Group[]>("/groups")
            .then(({ data }) => setGroups(data))
            .catch(() => { })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    const handleCreate = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post("/groups", { name, type, is_temporary: isTemporary });
            setShowForm(false);
            setName("");
            fetchGroups();
        } catch {
            // ignore
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">그룹</h1>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                    {showForm ? "취소" : "+ 새 그룹"}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleCreate} className="bg-white rounded-xl border p-6 mb-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">그룹명</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">타입</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            >
                                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                                    <option key={v} value={v}>{l}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center gap-2 text-sm pb-2">
                                <input
                                    type="checkbox"
                                    checked={isTemporary}
                                    onChange={(e) => setIsTemporary(e.target.checked)}
                                    className="rounded"
                                />
                                임시 그룹
                            </label>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                        생성
                    </button>
                </form>
            )}

            {loading ? (
                <p className="text-gray-400">로딩 중...</p>
            ) : groups.length === 0 ? (
                <p className="text-gray-400">그룹이 없습니다.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groups.map((g) => (
                        <div key={g.id} className="bg-white rounded-xl border border-gray-200 p-5">
                            <div className="flex items-start justify-between mb-3">
                                <h3 className="font-semibold text-gray-900">{g.name}</h3>
                                {g.is_temporary && (
                                    <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">임시</span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                                    {TYPE_LABELS[g.type] || g.type}
                                </span>
                                <span>👥 {g.member_count}명</span>
                            </div>
                            {g.expires_at && (
                                <div className="text-xs text-red-500 mt-2">
                                    만료: {new Date(g.expires_at).toLocaleDateString("ko-KR")}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
