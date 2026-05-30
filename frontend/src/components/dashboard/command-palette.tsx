"use client";

import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
    ArrowUpRight,
    CalendarClock,
    FolderKanban,
    Loader2,
    Medal,
    Plus,
    Search,
    Users,
    Zap,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DASHBOARD_NAV_ITEMS } from "@/lib/dashboard-nav";
import type { Group, Project, Schedule, User } from "@/types";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userRole: User["role"];
}

interface PaletteItem {
    id: string;
    section: string;
    label: string;
    description: string;
    href: string;
    icon: LucideIcon;
    keywords: string[];
}

const QUICK_ACTIONS: PaletteItem[] = [
    {
        id: "new-schedule",
        section: "빠른 실행",
        label: "새 일정 만들기",
        description: "지금 바로 새 일정 추가",
        href: "/dashboard/schedules/new",
        icon: Plus,
        keywords: ["일정", "생성", "추가", "new", "schedule"],
    },
    {
        id: "new-project",
        section: "빠른 실행",
        label: "프로젝트 열기",
        description: "프로젝트 목록으로 이동해서 새 프로젝트 생성",
        href: "/dashboard/projects",
        icon: FolderKanban,
        keywords: ["프로젝트", "생성", "추가", "project"],
    },
    {
        id: "profile",
        section: "빠른 실행",
        label: "내 루넬 프로필",
        description: "티어, 점수, 업적, 활동 히트맵 보기",
        href: "/dashboard/profile",
        icon: Medal,
        keywords: ["프로필", "점수", "티어", "업적", "profile"],
    },
    {
        id: "focus",
        section: "빠른 실행",
        label: "지금 중요한 것 보기",
        description: "우선순위 대시보드로 이동",
        href: "/dashboard",
        icon: Zap,
        keywords: ["우선순위", "집중", "홈", "dashboard", "focus"],
    },
];

function normalize(value: string) {
    return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesQuery(item: PaletteItem, query: string) {
    if (!query) return true;
    const haystack = normalize([
        item.label,
        item.description,
        ...item.keywords,
    ].join(" "));
    return haystack.includes(query);
}

export default function CommandPalette({
    open,
    onOpenChange,
    userRole,
}: CommandPaletteProps) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);

    useEffect(() => {
        const handleKeydown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                onOpenChange(true);
            }
        };

        window.addEventListener("keydown", handleKeydown);
        return () => window.removeEventListener("keydown", handleKeydown);
    }, [onOpenChange]);

    useEffect(() => {
        if (!open) {
            setQuery("");
            setHighlightedIndex(0);
            return;
        }

        setLoading(true);
        setHighlightedIndex(0);

        Promise.all([
            api.get<Schedule[]>("/schedules"),
            api.get<Project[]>("/projects"),
            api.get<Group[]>("/groups"),
        ])
            .then(([scheduleRes, projectRes, groupRes]) => {
                setSchedules(scheduleRes.data);
                setProjects(projectRes.data);
                setGroups(groupRes.data);
            })
            .catch(() => toast.error("명령 팔레트 데이터를 불러올 수 없습니다."))
            .finally(() => setLoading(false));
    }, [open]);


    const navigationItems = useMemo(
        () =>
            DASHBOARD_NAV_ITEMS.map((item) => ({
                id: item.href,
                section: "이동",
                label: item.label,
                description: `${item.label} 화면으로 이동`,
                href: item.href,
                icon: item.icon,
                keywords: [item.label, item.href.replace("/dashboard/", "")],
            })),
        []
    );

    const scheduleItems = useMemo(
        () =>
            [...schedules]
                .sort((left, right) => right.importance_score - left.importance_score)
                .map((schedule) => ({
                    id: `schedule-${schedule.id}`,
                    section: "일정",
                    label: schedule.title,
                    description: `${schedule.type} · ${schedule.status} · 중요도 ${schedule.importance_score}`,
                    href: `/dashboard/schedules/${schedule.id}`,
                    icon: CalendarClock,
                    keywords: [
                        schedule.title,
                        schedule.type,
                        schedule.status,
                        schedule.subtype,
                        schedule.location ?? "",
                        ...(schedule.visibility_policy_id ? ["챌린지", "보안", "인증", "challenge"] : []),
                    ],
                })),
        [schedules]
    );

    const projectItems = useMemo(
        () =>
            [...projects]
                .sort(
                    (left, right) =>
                        new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
                )
                .map((project) => ({
                    id: `project-${project.id}`,
                    section: "프로젝트",
                    label: project.title,
                    description: `${project.status} · 진행률 ${project.progress_percent}%`,
                    href: `/dashboard/projects/${project.id}`,
                    icon: FolderKanban,
                    keywords: [
                        project.title, 
                        project.status, 
                        project.description ?? "",
                        ...(project.visibility_policy_id ? ["챌린지", "보안", "인증", "challenge"] : []),
                    ],
                })),
        [projects]
    );

    const groupItems = useMemo(
        () =>
            [...groups]
                .sort((left, right) => right.member_count - left.member_count)
                .map((group) => ({
                    id: `group-${group.id}`,
                    section: "그룹",
                    label: group.name,
                    description: `${group.type} · 멤버 ${group.member_count}명`,
                    href: `/dashboard/groups/${group.id}`,
                    icon: Users,
                    keywords: [group.name, group.type, group.is_temporary ? "임시" : ""],
                })),
        [groups]
    );

    const filteredSections = useMemo(() => {
        const normalizedQuery = normalize(query);
        const sections = [
            { title: "빠른 실행", items: QUICK_ACTIONS },
            { title: "이동", items: navigationItems },
            { title: "일정", items: scheduleItems },
            { title: "프로젝트", items: projectItems },
            { title: "그룹", items: groupItems },
        ];

        return sections
            .map((section) => ({
                title: section.title,
                items: section.items
                    .filter((item) => matchesQuery(item, normalizedQuery))
                    .slice(0, normalizedQuery ? 8 : 5),
            }))
            .filter((section) => section.items.length > 0);
    }, [groupItems, navigationItems, projectItems, query, scheduleItems]);

    const flatItems = useMemo(
        () => filteredSections.flatMap((section) => section.items),
        [filteredSections]
    );

    useEffect(() => {
        if (flatItems.length === 0) {
            setHighlightedIndex(0);
            return;
        }
        setHighlightedIndex((current) => Math.min(current, flatItems.length - 1));
    }, [flatItems]);

    const handleSelect = (item: PaletteItem) => {
        onOpenChange(false);
        router.push(item.href);
    };

    const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (flatItems.length === 0) return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlightedIndex((current) => (current + 1) % flatItems.length);
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((current) =>
                current === 0 ? flatItems.length - 1 : current - 1
            );
        }

        if (event.key === "Enter") {
            event.preventDefault();
            handleSelect(flatItems[highlightedIndex]);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden">
                <DialogHeader className="border-b border-border/50 px-4 py-4">
                    <DialogTitle className="text-sm">루넬 명령 팔레트</DialogTitle>
                    <DialogDescription className="text-xs">
                        이동, 검색, 빠른 실행을 한 번에 처리합니다.
                    </DialogDescription>
                    <div className="relative mt-3">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            autoFocus
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={handleInputKeyDown}
                            placeholder="일정, 프로젝트, 그룹, 화면을 검색하세요"
                            className="h-11 pl-9 pr-16 text-sm"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-foreground/[0.04] px-2 py-1 text-[10px] font-medium text-muted-foreground">
                            Ctrl K
                        </span>
                    </div>
                </DialogHeader>

                <div className="max-h-[65vh] overflow-y-auto px-3 py-3">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            데이터 불러오는 중...
                        </div>
                    ) : flatItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                            <Search className="h-5 w-5 text-muted-foreground/60" />
                            <p className="text-sm font-medium">검색 결과가 없습니다.</p>
                            <p className="text-xs text-muted-foreground">
                                다른 키워드로 다시 찾거나 빠른 실행 항목을 이용하세요.
                            </p>
                        </div>
                    ) : (
                        (() => {
                            let visibleIndex = -1;

                            return filteredSections.map((section) => (
                                <div key={section.title} className="mb-4 last:mb-0">
                                    <div className="px-2 pb-2 text-[11px] font-semibold text-muted-foreground">
                                        {section.title}
                                    </div>
                                    <div className="space-y-1">
                                        {section.items.map((item) => {
                                            visibleIndex += 1;
                                            const active = visibleIndex === highlightedIndex;
                                            const Icon = item.icon;

                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => handleSelect(item)}
                                                    onMouseEnter={() => setHighlightedIndex(visibleIndex)}
                                                    className={cn(
                                                        "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
                                                        active
                                                            ? "bg-primary/10 text-foreground"
                                                            : "hover:bg-foreground/[0.03]"
                                                    )}
                                                >
                                                    <div
                                                        className={cn(
                                                            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                                                            active ? "bg-primary/12 text-primary" : "bg-foreground/[0.04] text-muted-foreground"
                                                        )}
                                                    >
                                                        <Icon className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-sm font-medium">
                                                            {item.label}
                                                        </div>
                                                        <div className="truncate text-xs text-muted-foreground">
                                                            {item.description}
                                                        </div>
                                                    </div>
                                                    <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ));
                        })()
                    )}
                </div>

                <div className="flex items-center justify-between border-t border-border/50 px-4 py-3 text-[11px] text-muted-foreground">
                    <span>상하 방향키로 이동하고 Enter로 실행</span>
                    <span>{userRole} 모드</span>
                </div>
            </DialogContent>
        </Dialog>
    );
}