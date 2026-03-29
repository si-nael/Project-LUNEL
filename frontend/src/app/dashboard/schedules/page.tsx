"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Schedule } from "@/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const STATUS_LABELS: Record<string, string> = {
    DRAFT: "초안",
    SCHEDULED: "예정",
    IN_PROGRESS: "진행 중",
    COMPLETED: "완료",
    CANCELLED: "취소",
};

const TYPE_LABELS: Record<string, string> = {
    PROJECT: "프로젝트",
    INTERVAL: "인터벌",
    EVENT: "이벤트",
};

export default function SchedulesPage() {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState("__all__");
    const [filterStatus, setFilterStatus] = useState("__all__");

    useEffect(() => {
        const params = new URLSearchParams();
        if (filterType && filterType !== "__all__") params.set("type", filterType);
        if (filterStatus && filterStatus !== "__all__") params.set("status", filterStatus);
        api.get<Schedule[]>(`/schedules?${params}`)
            .then(({ data }) => setSchedules(data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [filterType, filterStatus]);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-semibold tracking-tight">일정 목록</h1>
                <Button asChild>
                    <Link href="/dashboard/schedules/new">
                        <Plus className="h-4 w-4 mr-2" />
                        새 일정
                    </Link>
                </Button>
            </div>

            <div className="flex gap-3 mb-4">
                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-36">
                        <SelectValue placeholder="전체 타입" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">전체 타입</SelectItem>
                        <SelectItem value="PROJECT">프로젝트</SelectItem>
                        <SelectItem value="INTERVAL">인터벌</SelectItem>
                        <SelectItem value="EVENT">이벤트</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-36">
                        <SelectValue placeholder="전체 상태" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">전체 상태</SelectItem>
                        <SelectItem value="SCHEDULED">예정</SelectItem>
                        <SelectItem value="IN_PROGRESS">진행 중</SelectItem>
                        <SelectItem value="COMPLETED">완료</SelectItem>
                        <SelectItem value="CANCELLED">취소</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
            ) : schedules.length === 0 ? (
                <p className="text-muted-foreground text-center py-20">일정이 없습니다.</p>
            ) : (
                <Card className="divide-y">
                    {schedules.map((s) => (
                        <Link
                            key={s.id}
                            href={`/dashboard/schedules/${s.id}`}
                            className="flex items-center justify-between p-4 hover:bg-foreground/[0.02] transition-all duration-200"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-medium truncate">{s.title}</h3>
                                    <Badge variant="outline" className="text-[10px]">
                                        {TYPE_LABELS[s.type] || s.type}
                                    </Badge>
                                    <Badge variant="secondary" className="text-[10px]">
                                        {STATUS_LABELS[s.status] || s.status}
                                    </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {new Date(s.start_at).toLocaleString("ko-KR")}
                                    {s.end_at && ` ~ ${new Date(s.end_at).toLocaleString("ko-KR")}`}
                                    {s.location && ` · ${s.location}`}
                                </div>
                            </div>
                            <div className="ml-4 text-right">
                                <Badge
                                    variant={
                                        s.importance_score >= 80
                                            ? "destructive"
                                            : s.importance_score >= 60
                                                ? "default"
                                                : "secondary"
                                    }
                                    className="text-base px-3"
                                >
                                    {s.importance_score}
                                </Badge>
                                <div className="text-[10px] text-muted-foreground mt-1">중요도</div>
                            </div>
                        </Link>
                    ))}
                </Card>
            )}
        </div>
    );
}
