"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { User } from "@/types";

interface AuthContextType {
    user: User;
    loading: false;
    login: () => Promise<void>;
    register: () => Promise<void>;
    logout: () => void;
}

const LOCAL_OPERATOR: User = {
    id: "local-operator",
    email: "local@lunel.engine",
    name: "로컬 운영자",
    role: "ADMIN",
    class_info: null,
    is_active: true,
    created_at: new Date(0).toISOString(),
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    return (
        <AuthContext.Provider
            value={{
                user: LOCAL_OPERATOR,
                loading: false,
                login: async () => undefined,
                register: async () => undefined,
                logout: () => undefined,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be inside AuthProvider");
    return context;
}
