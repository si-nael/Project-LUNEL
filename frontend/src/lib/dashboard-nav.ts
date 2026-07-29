import type { LucideIcon } from "lucide-react";
import { Gauge, Trophy, FileCode2 } from "lucide-react";

export interface DashboardNavItem {
    href: string;
    label: string;
    icon: LucideIcon;
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
    { href: "/dashboard", label: "엔진", icon: Gauge },
    { href: "/dashboard/competitions", label: "대회", icon: Trophy },
    { href: "/dashboard/problems", label: "문제", icon: FileCode2 },
];
