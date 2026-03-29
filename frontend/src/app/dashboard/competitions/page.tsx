"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users, FileText } from "lucide-react";

interface Event {
    id: string;
    event_type: string;
    title: string;
    status: string;
    created_at: string;
}

interface CompetitionDetail {
    id: string;
    event_id: string;
    max_participants: number | null;
    scoring_rule: Record<string, unknown> | null;
    created_at: string;
}

interface Participant {
    id: string;
    user_id: string;
    status: string;
    registered_at: string;
}

const STATUS_LABELS: Record<string, string> = {
    PLANNED: "준비중",
    REGISTRATION_OPEN: "접수중",
    IN_PROGRESS: "진행중",
    JUDGING: "심사중",
    COMPLETED: "완료",
    CANCELLED: "취소",
};

const STATUS_COLORS: Record<string, string> = {
    PLANNED: "secondary",
    REGISTRATION_OPEN: "default",
    IN_PROGRESS: "default",
    JUDGING: "default",
    COMPLETED: "secondary",
    CANCELLED: "destructive",
};

export default function CompetitionsPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        api.get<Event[]>("/events")
            .then(({ data }) => setEvents(data))
            .catch(() => toast.error("이벤트 목록을 불러올 수 없습니다."))
            .finally(() => setLoading(false));
    }, []);

    const selectEvent = async (event: Event) => {
        setSelectedEvent(event);
        setCompetition(null);
        setParticipants([]);
        try {
            // Try to find a competition linked to this event
            // The API exposes GET /competitions/{id}, but we need to search by event_id
            // For now, we'll try fetching - in production this would be a query param
            const res = await api.get(`/events/${event.id}`);
            if (res.data) {
                // Event detail loaded - competition may be linked
                setSelectedEvent(res.data);
            }
        } catch {
            // No competition for this event
        }
    };

    const joinCompetition = async (competitionId: string) => {
        setJoining(true);
        try {
            await api.post(`/competitions/${competitionId}/participants`);
            toast.success("참가 신청이 완료되었습니다.");
            // Refresh participants
            const res = await api.get<Participant[]>(
                `/competitions/${competitionId}/participants`
            );
            setParticipants(res.data);
        } catch (err: unknown) {
            const axiosErr = err as {
                response?: { data?: { detail?: string } };
            };
            toast.error(
                axiosErr.response?.data?.detail || "참가 신청에 실패했습니다."
            );
        }
        setJoining(false);
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-semibold tracking-tight">
                    대회 / 행사
                </h1>
            </div>

            {events.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">
                            등록된 이벤트가 없습니다.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {events.map((event) => (
                        <Card
                            key={event.id}
                            className={`cursor-pointer transition-all hover:shadow-md ${selectedEvent?.id === event.id
                                    ? "ring-2 ring-primary/30"
                                    : ""
                                }`}
                            onClick={() => selectEvent(event)}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <CardTitle className="text-sm">
                                        {event.title}
                                    </CardTitle>
                                    <Badge
                                        variant={
                                            (STATUS_COLORS[event.status] as
                                                | "default"
                                                | "secondary"
                                                | "destructive") || "secondary"
                                        }
                                    >
                                        {STATUS_LABELS[event.status] ||
                                            event.status}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Trophy className="h-3 w-3" />
                                        {event.event_type}
                                    </span>
                                    <span>
                                        {new Date(
                                            event.created_at
                                        ).toLocaleDateString("ko-KR")}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Competition detail panel */}
            {competition && (
                <div className="mt-6 glass rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold">대회 정보</h2>
                        <Button
                            size="sm"
                            disabled={joining}
                            onClick={() => joinCompetition(competition.id)}
                        >
                            <Users className="h-3.5 w-3.5 mr-1.5" />
                            {joining ? "신청 중..." : "참가 신청"}
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-3 rounded-xl bg-secondary/50">
                            <p className="text-xs text-muted-foreground">
                                최대 참가 인원
                            </p>
                            <p className="text-lg font-semibold mt-1">
                                {competition.max_participants ?? "제한 없음"}
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-secondary/50">
                            <p className="text-xs text-muted-foreground">
                                현재 참가자
                            </p>
                            <p className="text-lg font-semibold mt-1">
                                {participants.length}명
                            </p>
                        </div>
                    </div>

                    {participants.length > 0 && (
                        <div>
                            <h3 className="text-xs font-medium text-muted-foreground mb-2">
                                참가자 목록
                            </h3>
                            <div className="space-y-1">
                                {participants.map((p) => (
                                    <div
                                        key={p.id}
                                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/30"
                                    >
                                        <span className="text-sm">
                                            {p.user_id.slice(0, 8)}...
                                        </span>
                                        <Badge variant="outline" className="text-[10px]">
                                            {p.status}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
