import type { LucideIcon } from "lucide-react";
import {
    BarChart3,
    Bell,
    Calendar,
    FolderKanban,
    GitBranch,
    History,
    Home,
    ListTodo,
    Medal,
    Settings,
    Trophy,
    Users,
} from "lucide-react";

export interface DashboardNavItem {
    href: string;
    label: string;
    icon: LucideIcon;
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
    { href: "/dashboard", label: "홈", icon: Home },
    { href: "/dashboard/profile", label: "내 루넬", icon: Medal },
    { href: "/dashboard/calendar", label: "캘린더", icon: Calendar },
    { href: "/dashboard/schedules", label: "일정", icon: ListTodo },
    { href: "/dashboard/projects", label: "프로젝트", icon: FolderKanban },
    { href: "/dashboard/groups", label: "그룹", icon: Users },
    { href: "/dashboard/notifications", label: "알림", icon: Bell },
    { href: "/dashboard/competitions", label: "대회", icon: Trophy },
    { href: "/dashboard/dag", label: "DAG", icon: GitBranch },
    { href: "/dashboard/history", label: "변경이력", icon: History },
    { href: "/dashboard/analysis", label: "분석", icon: BarChart3 },
    { href: "/dashboard/admin", label: "운영", icon: Settings },
];