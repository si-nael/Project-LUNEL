"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Notification } from "@/types";

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "unread">("all");

    const fetchNotifications = () => {
        const params = filter === "unread" ? "?unread_only=true" : "";
        api.get<Notification[]>(`/notifications${params}`)
            .then(({ data }) => setNotifications(data))
            .catch(() => { })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        setLoading(true);
        fetchNotifications();
    }, [filter]);

    const markRead = async (id: string) => {
        await api.patch(`/notifications/${id}/read`);
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
    };

    const markAllRead = async () => {
        await api.post("/notifications/read-all");
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    };

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                    알림
                    {unreadCount > 0 && (
                        <span className="ml-2 text-sm bg-red-500 text-white rounded-full px-2 py-0.5">
                            {unreadCount}
                        </span>
                    )}
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter(filter === "all" ? "unread" : "all")}
                        className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                    >
                        {filter === "all" ? "읽지 않은 것만" : "전체 보기"}
                    </button>
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllRead}
                            className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                        >
                            모두 읽음
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <p className="text-gray-400">로딩 중...</p>
            ) : notifications.length === 0 ? (
                <p className="text-gray-400">알림이 없습니다.</p>
            ) : (
                <div className="space-y-2">
                    {notifications.map((n) => (
                        <div
                            key={n.id}
                            className={`bg-white rounded-xl border p-4 flex items-start gap-3 cursor-pointer transition-colors ${n.is_read
                                    ? "border-gray-200"
                                    : "border-blue-300 bg-blue-50/40"
                                }`}
                            onClick={() => !n.is_read && markRead(n.id)}
                        >
                            <div
                                className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.is_read ? "bg-gray-300" : "bg-blue-500"
                                    }`}
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">
                                    {n.title}
                                </p>
                                {n.body && (
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        {n.body}
                                    </p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                    {new Date(n.created_at).toLocaleString("ko-KR")}
                                </p>
                            </div>
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded flex-shrink-0">
                                {n.type}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
