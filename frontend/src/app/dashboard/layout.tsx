"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Home,
    Calendar,
    ListTodo,
    FolderKanban,
    Users,
    Bell,
    Trophy,
    GitBranch,
    History,
    BarChart3,
    Settings,
    Moon,
    PanelLeftClose,
    PanelLeft,
    LogOut,
    ChevronsUpDown,
} from "lucide-react";

const NAV_ITEMS = [
    { href: "/dashboard", label: "홈", icon: Home },
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

export default function DashboardLayout({ children }: { children: ReactNode }) {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [loading, user, router]);

    // Close mobile sidebar on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Moon className="h-5 w-5 text-primary/40 animate-pulse" />
                    <p className="text-xs text-muted-foreground/60">로딩 중...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    const isActive = (href: string) => {
        if (href === "/dashboard") return pathname === "/dashboard";
        return pathname.startsWith(href);
    };

    return (
        <TooltipProvider delayDuration={0}>
            <div className="min-h-screen flex">
                {/* Mobile overlay */}
                {mobileOpen && (
                    <div
                        className="fixed inset-0 bg-black/30 z-40 lg:hidden"
                        onClick={() => setMobileOpen(false)}
                        aria-hidden="true"
                    />
                )}

                {/* Mobile header */}
                <header className="fixed top-0 left-0 right-0 h-14 flex items-center px-4 glass-subtle z-30 lg:hidden">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMobileOpen(true)}
                        aria-label="메뉴 열기"
                    >
                        <PanelLeft className="h-5 w-5" />
                    </Button>
                    <span className="ml-2 text-sm font-semibold tracking-tight">Lunel</span>
                </header>

                {/* Sidebar */}
                <aside
                    role="navigation"
                    aria-label="메인 내비게이션"
                    className={cn(
                        "fixed lg:sticky top-0 h-screen flex flex-col transition-all duration-300 glass-subtle z-50",
                        collapsed ? "lg:w-16" : "lg:w-60",
                        mobileOpen ? "w-60 translate-x-0" : "-translate-x-full lg:translate-x-0"
                    )}
                >
                    {/* Logo */}
                    <div className={cn("flex items-center h-14 px-4", collapsed ? "justify-center" : "gap-2.5")}>
                        <Moon className="h-4 w-4 shrink-0 text-primary" />
                        {!collapsed && (
                            <span className="text-sm font-semibold tracking-tight text-foreground">Lunel</span>
                        )}
                    </div>

                    <div className="mx-3 h-px bg-border/50" />

                    {/* Nav */}
                    <ScrollArea className="flex-1 py-3">
                        <nav className="flex flex-col gap-0.5 px-2">
                            {NAV_ITEMS.map((item) => {
                                const active = isActive(item.href);
                                const Icon = item.icon;
                                const link = (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-all duration-200",
                                            active
                                                ? "bg-primary/8 text-primary font-medium"
                                                : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03]",
                                            collapsed && "justify-center px-0"
                                        )}
                                    >
                                        <Icon className="h-4 w-4 shrink-0" />
                                        {!collapsed && <span>{item.label}</span>}
                                    </Link>
                                );

                                if (collapsed) {
                                    return (
                                        <Tooltip key={item.href}>
                                            <TooltipTrigger asChild>{link}</TooltipTrigger>
                                            <TooltipContent side="right" className="text-xs font-medium">
                                                {item.label}
                                            </TooltipContent>
                                        </Tooltip>
                                    );
                                }
                                return link;
                            })}
                        </nav>
                    </ScrollArea>

                    <div className="mx-3 h-px bg-border/50" />

                    {/* Footer */}
                    <div className="p-2">
                        {/* Collapse toggle */}
                        <Button
                            variant="ghost"
                            size={collapsed ? "icon" : "sm"}
                            className={cn(
                                "w-full text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03] mb-1",
                                collapsed ? "justify-center" : "justify-start gap-3"
                            )}
                            onClick={() => setCollapsed(!collapsed)}
                        >
                            {collapsed ? (
                                <PanelLeft className="h-4 w-4" />
                            ) : (
                                <>
                                    <PanelLeftClose className="h-4 w-4" />
                                    <span className="text-xs">접기</span>
                                </>
                            )}
                        </Button>

                        {/* User menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "w-full hover:bg-foreground/[0.03]",
                                        collapsed ? "justify-center px-0" : "justify-start gap-3 px-2"
                                    )}
                                    size={collapsed ? "icon" : "default"}
                                >
                                    <Avatar className="h-6 w-6">
                                        <AvatarFallback className="bg-primary/8 text-primary text-[10px] font-medium">
                                            {user.name[0]}
                                        </AvatarFallback>
                                    </Avatar>
                                    {!collapsed && (
                                        <div className="flex-1 text-left min-w-0">
                                            <p className="text-xs font-medium truncate text-foreground">
                                                {user.name}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground truncate">
                                                {user.email}
                                            </p>
                                        </div>
                                    )}
                                    {!collapsed && (
                                        <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                side={collapsed ? "right" : "top"}
                                align="start"
                                className="w-52"
                            >
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium">{user.name}</p>
                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive cursor-pointer"
                                    onClick={logout}
                                >
                                    <LogOut className="mr-2 h-3.5 w-3.5" />
                                    로그아웃
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </aside>

                {/* Main content */}
                <main className="flex-1 overflow-auto pt-14 lg:pt-0">
                    <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-fade-in">
                        {children}
                    </div>
                </main>
            </div>
        </TooltipProvider>
    );
}
