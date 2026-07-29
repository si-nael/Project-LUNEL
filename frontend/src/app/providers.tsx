"use client";

import { useEffect, type ReactNode } from "react";

import { AuthProvider } from "@/lib/auth-context";

export function Providers({ children }: { children: ReactNode }) {
    useEffect(() => {
        // Older LUNEL builds registered a PWA worker. Remove it so the local
        // engine console can never be shadowed by cached legacy screens.
        if ("serviceWorker" in navigator) {
            void navigator.serviceWorker
                .getRegistrations()
                .then((registrations) =>
                    Promise.all(
                        registrations.map((registration) => registration.unregister())
                    )
                );
        }
        if ("caches" in window) {
            void caches
                .keys()
                .then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
        }
    }, []);

    return <AuthProvider>{children}</AuthProvider>;
}
