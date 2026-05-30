import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
    title: "Lunel System",
    description: "권한 기반 일정·프로젝트 통합 관리 플랫폼",
    manifest: "/manifest.json",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ko" suppressHydrationWarning>
            <body className={cn(inter.variable, "font-sans min-h-screen")}>
                <Providers>{children}</Providers>
                <Toaster position="bottom-right" richColors closeButton />
            </body>
        </html>
    );
}
