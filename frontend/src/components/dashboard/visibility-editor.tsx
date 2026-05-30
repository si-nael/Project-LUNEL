"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Eye,
    Globe,
    KeyRound,
    Loader2,
    Lock,
    Shield,
    Users,
    UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Group, VisibilityPolicy } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// ── Props ────────────────────────────────────────────────────

interface VisibilityEditorProps {
    value?: string | null;
    onChange: (policyId: string | null) => void;
    targetType: "schedule" | "project";
}

// ── Constants ────────────────────────────────────────────────

type ScopeType = VisibilityPolicy["scope_type"];

const SCOPE_OPTIONS: {
    value: ScopeType;
    label: string;
    description: string;
    icon: React.ElementType;
}[] = [
    {
        value: "PUBLIC",
        label: "전체 공개",
        description: "누구나 열람 가능",
        icon: Globe,
    },
    {
        value: "AUTHENTICATED",
        label: "로그인 사용자",
        description: "로그인한 사용자만 접근 가능",
        icon: Eye,
    },
    {
        value: "GROUP_ONLY",
        label: "그룹 한정",
        description: "선택한 그룹 멤버만 접근 가능",
        icon: Users,
    },
    {
        value: "ROLE_ONLY",
        label: "역할 한정",
        description: "선택한 역할만 접근 가능",
        icon: UserCog,
    },
    {
        value: "GROUP_AND_ROLE",
        label: "그룹 + 역할",
        description: "그룹과 역할 조건 모두 충족해야 접근 가능",
        icon: Shield,
    },
    {
        value: "PROCEDURAL_KEY",
        label: "챌린지 인증",
        description: "수학/논리/텍스트 챌린지를 풀어야 접근 가능",
        icon: KeyRound,
    },
];

const ROLE_OPTIONS: { value: string; label: string }[] = [
    { value: "STUDENT", label: "학생" },
    { value: "TEACHER", label: "교사" },
    { value: "ADMIN", label: "관리자" },
];

// ── Component ────────────────────────────────────────────────

export default function VisibilityEditor({
    value,
    onChange,
    targetType,
}: VisibilityEditorProps) {
    const [scopeType, setScopeType] = useState<ScopeType>("PUBLIC");
    const [groups, setGroups] = useState<Group[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [loadingExisting, setLoadingExisting] = useState(false);

    // ── Load existing policy on mount ────────────────────────

    useEffect(() => {
        if (!value) return;

        setLoadingExisting(true);
        api.get<VisibilityPolicy>(`/visibility-policies/${value}`)
            .then(({ data }) => {
                setScopeType(data.scope_type);
                setSelectedGroupIds(data.allow_group_ids);
                setSelectedRoles(data.allow_role_names);
            })
            .catch(() => {
                // Policy not found or error — reset to defaults
            })
            .finally(() => setLoadingExisting(false));
    }, [value]);

    // ── Fetch groups when needed ─────────────────────────────

    const needsGroups = scopeType === "GROUP_ONLY" || scopeType === "GROUP_AND_ROLE";
    const needsRoles = scopeType === "ROLE_ONLY" || scopeType === "GROUP_AND_ROLE";

    useEffect(() => {
        if (!needsGroups || groups.length > 0) return;

        setLoadingGroups(true);
        api.get<Group[]>("/groups")
            .then(({ data }) => setGroups(data))
            .catch(() => toast.error("그룹 목록을 불러올 수 없습니다."))
            .finally(() => setLoadingGroups(false));
    }, [needsGroups, groups.length]);

    // ── Group toggle ─────────────────────────────────────────

    const toggleGroup = useCallback((groupId: string) => {
        setSelectedGroupIds((prev) =>
            prev.includes(groupId)
                ? prev.filter((id) => id !== groupId)
                : [...prev, groupId]
        );
    }, []);

    // ── Role toggle ──────────────────────────────────────────

    const toggleRole = useCallback((role: string) => {
        setSelectedRoles((prev) =>
            prev.includes(role)
                ? prev.filter((r) => r !== role)
                : [...prev, role]
        );
    }, []);

    // ── Save policy ──────────────────────────────────────────

    const handleSave = async () => {
        // Validation
        if (needsGroups && selectedGroupIds.length === 0) {
            toast.error("최소 한 개의 그룹을 선택하세요.");
            return;
        }
        if (needsRoles && selectedRoles.length === 0) {
            toast.error("최소 한 개의 역할을 선택하세요.");
            return;
        }

        setSaving(true);

        try {
            const payload = {
                scope_type: scopeType,
                allow_public: scopeType === "PUBLIC",
                allow_group_ids: needsGroups ? selectedGroupIds : [],
                allow_role_names: needsRoles ? selectedRoles : [],
                deny_group_ids: [],
                rule_expression_json: null,
            };

            let policyId: string;

            if (value) {
                // Update existing
                const { data } = await api.put<VisibilityPolicy>(
                    `/visibility-policies/${value}`,
                    payload
                );
                policyId = data.id;
                toast.success("공개 정책이 수정되었습니다.");
            } else {
                // Create new
                const { data } = await api.post<VisibilityPolicy>(
                    "/visibility-policies",
                    payload
                );
                policyId = data.id;
                toast.success("공개 정책이 생성되었습니다.");
            }

            onChange(policyId);
        } catch {
            toast.error("공개 정책 저장에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    };

    // ── Clear policy ─────────────────────────────────────────

    const handleClear = () => {
        setScopeType("PUBLIC");
        setSelectedGroupIds([]);
        setSelectedRoles([]);
        onChange(null);
    };

    // ── Loading existing ─────────────────────────────────────

    if (loadingExisting) {
        return (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                기존 정책 불러오는 중...
            </div>
        );
    }

    // ── Render ───────────────────────────────────────────────

    const targetLabel = targetType === "schedule" ? "일정" : "프로젝트";

    return (
        <div className="space-y-5">
            {/* Section heading */}
            <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">
                    {targetLabel} 공개 범위 설정
                </Label>
            </div>

            {/* Scope selector */}
            <Select
                value={scopeType}
                onValueChange={(v) => {
                    setScopeType(v as ScopeType);
                    setSelectedGroupIds([]);
                    setSelectedRoles([]);
                }}
            >
                <SelectTrigger className="h-10">
                    <SelectValue placeholder="공개 범위를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                    {SCOPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                                <opt.icon className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{opt.label}</span>
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Scope description */}
            <p className="text-xs text-muted-foreground">
                {SCOPE_OPTIONS.find((o) => o.value === scopeType)?.description}
            </p>

            {/* GROUP picker */}
            {needsGroups && (
                <div className="space-y-2.5">
                    <Label className="text-xs text-muted-foreground">
                        그룹 선택
                    </Label>

                    {loadingGroups ? (
                        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            그룹 불러오는 중...
                        </div>
                    ) : groups.length === 0 ? (
                        <p className="py-3 text-xs text-muted-foreground/70">
                            가입된 그룹이 없습니다.
                        </p>
                    ) : (
                        <div className="grid gap-1.5 max-h-48 overflow-y-auto rounded-xl border border-border/40 p-2">
                            {groups.map((group) => {
                                const selected = selectedGroupIds.includes(group.id);
                                return (
                                    <button
                                        key={group.id}
                                        type="button"
                                        onClick={() => toggleGroup(group.id)}
                                        className={cn(
                                            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-all",
                                            selected
                                                ? "bg-primary/10 text-foreground"
                                                : "hover:bg-foreground/[0.03] text-muted-foreground"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                                                selected
                                                    ? "border-primary bg-primary text-primary-foreground"
                                                    : "border-border/60"
                                            )}
                                        >
                                            {selected && (
                                                <svg
                                                    className="h-3 w-3"
                                                    viewBox="0 0 12 12"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M2.5 6l2.5 2.5 4.5-5" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <span className="font-medium">{group.name}</span>
                                            <span className="ml-1.5 text-[11px] text-muted-foreground">
                                                ({group.type} · {group.member_count}명)
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ROLE picker */}
            {needsRoles && (
                <div className="space-y-2.5">
                    <Label className="text-xs text-muted-foreground">
                        역할 선택
                    </Label>
                    <div className="flex flex-wrap gap-2">
                        {ROLE_OPTIONS.map((role) => {
                            const selected = selectedRoles.includes(role.value);
                            return (
                                <button
                                    key={role.value}
                                    type="button"
                                    onClick={() => toggleRole(role.value)}
                                    className={cn(
                                        "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all",
                                        selected
                                            ? "border-primary bg-primary/10 text-foreground"
                                            : "border-border/60 text-muted-foreground hover:bg-foreground/[0.03]"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                                            selected
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border/60"
                                        )}
                                    >
                                        {selected && (
                                            <svg
                                                className="h-2.5 w-2.5"
                                                viewBox="0 0 12 12"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M2.5 6l2.5 2.5 4.5-5" />
                                            </svg>
                                        )}
                                    </div>
                                    {role.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* PROCEDURAL_KEY info */}
            {scopeType === "PROCEDURAL_KEY" && (
                <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4">
                    <div className="flex items-start gap-2.5">
                        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-amber-400">
                                챌린지 인증 모드
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                이 {targetLabel}에 접근하려는 사용자는 수학, 텍스트, 또는 논리
                                챌린지를 풀어야 합니다. 챌린지는 접근 시도 시 자동으로
                                생성되며, 제한 시간 내에 정답을 입력해야 합니다.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Current status */}
            {value && (
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                        정책 ID: {value.slice(0, 8)}...
                    </Badge>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    size="sm"
                    className="min-w-[100px]"
                >
                    {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : value ? (
                        "정책 수정"
                    ) : (
                        "정책 생성"
                    )}
                </Button>

                {value && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        className="text-muted-foreground"
                    >
                        초기화
                    </Button>
                )}
            </div>
        </div>
    );
}
