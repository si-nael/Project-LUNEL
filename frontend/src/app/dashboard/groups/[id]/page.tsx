"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, UserPlus, UserMinus, Crown, Shield, User, Eye } from "lucide-react";

interface GroupDetail {
    id: string;
    name: string;
    type: string;
    owner_user_id: string;
    is_temporary: boolean;
    expires_at: string | null;
    is_active: boolean;
    created_at: string;
    member_count: number;
}

interface Member {
    id: string;
    user_id: string;
    membership_role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
    joined_at: string;
    expires_at: string | null;
    user_name?: string;
    user_email?: string;
}

const TYPE_LABELS: Record<string, string> = {
    SCHOOL: "학교",
    GRADE: "학년",
    CLASS: "반",
    CLUB: "동아리",
    PROJECT_TEAM: "프로젝트 팀",
    TEMPORARY: "임시",
    STAFF: "교직원",
};

const ROLE_LABELS: Record<string, string> = {
    OWNER: "소유자",
    ADMIN: "관리자",
    MEMBER: "멤버",
    VIEWER: "열람자",
};

const ROLE_ICONS: Record<string, typeof Crown> = {
    OWNER: Crown,
    ADMIN: Shield,
    MEMBER: User,
    VIEWER: Eye,
};

export default function GroupDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const [group, setGroup] = useState<GroupDetail | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    // Add member form
    const [showAdd, setShowAdd] = useState(false);
    const [addUserId, setAddUserId] = useState("");
    const [addRole, setAddRole] = useState<string>("MEMBER");
    const [adding, setAdding] = useState(false);

    const fetchData = async () => {
        try {
            const { data } = await api.get(`/groups/${id}`);
            setGroup(data);
            // Try to get member list - the backend response may include members
            if (data.members) {
                setMembers(data.members);
            }
        } catch {
            toast.error("그룹 정보를 불러올 수 없습니다.");
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const isAdmin = user?.id === group?.owner_user_id || user?.role === "ADMIN";

    const addMember = async () => {
        if (!addUserId.trim()) {
            toast.error("사용자 ID를 입력하세요.");
            return;
        }
        setAdding(true);
        try {
            await api.post(`/groups/${id}/members`, {
                user_id: addUserId,
                membership_role: addRole,
            });
            toast.success("멤버가 추가되었습니다.");
            setAddUserId("");
            setShowAdd(false);
            fetchData();
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { detail?: string } } };
            toast.error(axiosErr.response?.data?.detail || "멤버 추가에 실패했습니다.");
        }
        setAdding(false);
    };

    const removeMember = async (userId: string) => {
        if (!confirm("이 멤버를 제거하시겠습니까?")) return;
        try {
            await api.delete(`/groups/${id}/members/${userId}`);
            toast.success("멤버가 제거되었습니다.");
            fetchData();
        } catch {
            toast.error("멤버 제거에 실패했습니다.");
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            </div>
        );
    }

    if (!group) {
        return <p className="text-sm text-destructive">그룹을 찾을 수 없습니다.</p>;
    }

    return (
        <div className="max-w-2xl">
            {/* Header */}
            <div className="flex items-center gap-2 mb-6">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/groups">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-xl font-semibold tracking-tight">{group.name}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{TYPE_LABELS[group.type] || group.type}</Badge>
                        {group.is_temporary && <Badge variant="secondary">임시 그룹</Badge>}
                        {!group.is_active && <Badge variant="destructive">비활성</Badge>}
                    </div>
                </div>
            </div>

            {/* Info */}
            <Card className="mb-6">
                <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-xs text-muted-foreground">멤버 수</span>
                            <p className="font-medium">{group.member_count}명</p>
                        </div>
                        <div>
                            <span className="text-xs text-muted-foreground">생성일</span>
                            <p className="font-medium">{new Date(group.created_at).toLocaleDateString("ko-KR")}</p>
                        </div>
                        {group.expires_at && (
                            <div className="col-span-2">
                                <span className="text-xs text-muted-foreground">만료일</span>
                                <p className="font-medium text-destructive">
                                    {new Date(group.expires_at).toLocaleString("ko-KR")}
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Members */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">멤버 목록</CardTitle>
                        {isAdmin && (
                            <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>
                                <UserPlus className="h-3.5 w-3.5 mr-1" />
                                멤버 추가
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Add member form */}
                    {showAdd && (
                        <div className="p-3 mb-4 rounded-lg border border-border/50 space-y-3">
                            <div>
                                <Label className="text-xs mb-1 block">사용자 ID (UUID)</Label>
                                <Input
                                    value={addUserId}
                                    onChange={(e) => setAddUserId(e.target.value)}
                                    placeholder="사용자 UUID 입력"
                                />
                            </div>
                            <div>
                                <Label className="text-xs mb-1 block">역할</Label>
                                <select
                                    value={addRole}
                                    onChange={(e) => setAddRole(e.target.value)}
                                    className="w-full border border-input bg-background rounded-md px-3 py-2 text-sm"
                                >
                                    <option value="MEMBER">멤버</option>
                                    <option value="ADMIN">관리자</option>
                                    <option value="VIEWER">열람자</option>
                                </select>
                            </div>
                            <Button size="sm" onClick={addMember} disabled={adding}>
                                {adding ? "추가 중..." : "추가"}
                            </Button>
                        </div>
                    )}

                    {/* Member list */}
                    {members.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">
                            멤버 정보가 표시되지 않습니다. 그룹 상세 API에서 멤버 목록이 제공되지 않을 수 있습니다.
                        </p>
                    ) : (
                        <div className="divide-y divide-border/40">
                            {members.map((m) => {
                                const RoleIcon = ROLE_ICONS[m.membership_role] || User;
                                return (
                                    <div key={m.id} className="flex items-center justify-between py-3">
                                        <div className="flex items-center gap-3">
                                            <RoleIcon className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="text-sm font-medium">
                                                    {m.user_name || m.user_id.slice(0, 8) + "..."}
                                                </p>
                                                {m.user_email && (
                                                    <p className="text-[11px] text-muted-foreground">{m.user_email}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[10px]">
                                                {ROLE_LABELS[m.membership_role]}
                                            </Badge>
                                            {isAdmin && m.membership_role !== "OWNER" && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                                    onClick={() => removeMember(m.user_id)}
                                                >
                                                    <UserMinus className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
