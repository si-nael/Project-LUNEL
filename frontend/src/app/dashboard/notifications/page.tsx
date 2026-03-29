"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Notification } from "@/types";
import { toast } from "sonner";

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "unread">("all");

    const fetchNotifications = () => {
        const params = filter === "unread" ? "?unread_only=true" : "";
        api.get<Notification[]>(`/notifications${params}`)
            .then(({ data }) => setNotifications(data))
            .catch(() => toast.error("알림을 불러올 수 없습니다."))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        setLoading(true);
        fetchNotifications();
    }, [filter]);

    const markRead = async (id: string) => {
        try {
            await api.patch(`/notifications/${id}/read`);
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
            );
        } catch {
            toast.error("알림 읽음 처리에 실패했습니다.");
        }
    };

    const markAllRead = async () => {
        try {
            await api.post("/notifications/read-all");
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        } catch {
            toast.error("전체 읽음 처리에 실패했습니다.");
        }
    };

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-semibold tracking-tight">
                    알림
                    {unreadCount > 0 && (
                        <span className="ml-2 text-xs bg-destructive/10 text-destructive rounded-full px-2 py-0.5">
                            {unreadCount}
                        </span>
                    )}
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter(filter === "all" ? "unread" : "all")}
                        className="text-xs px-3 py-1.5 rounded-xl border border-border/60 hover:bg-foreground/[0.03] transition-all"
                    >
                        {filter === "all" ? "읽지 않은 것만" : "전체 보기"}
                    </button>
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllRead}
                            className="text-xs px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                        >
                            모두 읽음
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
            ) : notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-20">알림이 없습니다.</p>
            ) : (
                <div className="space-y-2">
                    {notifications.map((n) => (
                        <div
                            key={n.id}
                            className={`glass rounded-2xl p-4 flex items-start gap-3 cursor-pointer transition-all duration-200 ${n.is_read
                                ? ""
                                : "ring-1 ring-primary/20"
                                }`}
                            onClick={() => !n.is_read && markRead(n.id)}
                        >
                            <div
                                className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${n.is_read ? "bg-foreground/15" : "bg-primary/60"
                                    }`}
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">
                                    {n.title}
                                </p>
                                {n.body && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {n.body}
                                    </p>
                                )}
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    {new Date(n.created_at).toLocaleString("ko-KR")}
                                </p>
                            </div>
                            <span className="text-[10px] bg-foreground/[0.04] text-muted-foreground px-2 py-0.5 rounded-full flex-shrink-0">
                                {n.type}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
