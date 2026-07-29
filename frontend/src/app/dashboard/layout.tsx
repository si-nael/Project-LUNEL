"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, Server, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { DASHBOARD_NAV_ITEMS } from "@/lib/dashboard-nav";
import { cn } from "@/lib/utils";

export default function DashboardLayout({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        if (!loading && !user) router.push("/login");
    }, [loading, user, router]);

    useEffect(() => setMobileOpen(false), [pathname]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
                LUNEL을 시작하는 중입니다.
            </div>
        );
    }
    if (!user) return null;

    const isActive = (href: string) =>
        href === "/dashboard" ? pathname === href : pathname.startsWith(href);

    const sidebar = (
        <aside className="flex h-full w-56 flex-col border-r bg-card">
            <div className="flex h-16 items-center border-b px-5">
                <div>
                    <p className="text-sm font-semibold tracking-[0.18em]">LUNEL</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                        LOCAL CONTROL
                    </p>
                </div>
                <Button
                    className="ml-auto md:hidden"
                    size="icon"
                    variant="ghost"
                    onClick={() => setMobileOpen(false)}
                    aria-label="메뉴 닫기"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <nav className="space-y-1 p-3">
                {DASHBOARD_NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                                isActive(item.href)
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto border-t p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Server className="h-3.5 w-3.5" />
                    로컬 엔진 API
                </div>
                <p className="mt-1 truncate text-[10px] text-muted-foreground/70">
                    127.0.0.1:8100
                </p>
            </div>
        </aside>
    );

    return (
        <div className="min-h-screen bg-background md:flex">
            <div className="fixed inset-y-0 left-0 z-40 hidden md:block">
                {sidebar}
            </div>

            {mobileOpen && (
                <>
                    <button
                        className="fixed inset-0 z-40 bg-black/30 md:hidden"
                        onClick={() => setMobileOpen(false)}
                        aria-label="메뉴 닫기"
                    />
                    <div className="fixed inset-y-0 left-0 z-50 md:hidden">
                        {sidebar}
                    </div>
                </>
            )}

            <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center border-b bg-card px-4 md:hidden">
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setMobileOpen(true)}
                    aria-label="메뉴 열기"
                >
                    <Menu className="h-5 w-5" />
                </Button>
                <span className="ml-2 text-sm font-semibold tracking-[0.16em]">
                    LUNEL
                </span>
            </header>

            <main className="min-w-0 flex-1 pt-14 md:ml-56 md:pt-0">
                <div className="mx-auto max-w-6xl p-5 md:p-8">{children}</div>
            </main>
        </div>
    );
}
