"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
    const { login } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);
        try {
            await login(email, password);
            router.push("/dashboard");
        } catch {
            setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center space-y-2 pb-2">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <Moon className="h-4 w-4 text-primary" />
                        <CardTitle className="text-xl tracking-tight">Lunel</CardTitle>
                    </div>
                    <CardDescription>로그인하여 시작하세요</CardDescription>
                </CardHeader>

                <CardContent>
                    {error && (
                        <div className="bg-destructive/8 text-destructive px-3 py-2 rounded-lg mb-4 text-xs">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-xs text-foreground/60">이메일</Label>
                            <Input
                                id="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="email@example.com"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-xs text-foreground/60">비밀번호</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="8자 이상"
                            />
                        </div>
                        <Button
                            type="submit"
                            disabled={submitting}
                            className="w-full"
                        >
                            {submitting ? "로그인 중..." : "로그인"}
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="justify-center">
                    <p className="text-xs text-muted-foreground">
                        계정이 없으신가요?{" "}
                        <Link
                            href="/register"
                            className="text-primary hover:underline font-medium"
                        >
                            회원가입
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
