import type { Metadata } from "next";
import { Toaster } from "sonner";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
    title: "LUNEL Engine Console",
    description: "로컬 LUNEL Engine을 운영하는 대회 제어 콘솔",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ko">
            <body className="min-h-screen font-sans">
                <Providers>{children}</Providers>
                <Toaster position="bottom-right" richColors closeButton />
            </body>
        </html>
    );
}
