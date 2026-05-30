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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function RegisterPage() {
    const { register } = useAuth();
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("STUDENT");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);
        try {
            await register({ email, password, name, role });
            router.push("/login");
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { detail?: any } } };
            const detail = axiosErr.response?.data?.detail;
            const msg = Array.isArray(detail) ? detail[0]?.msg : detail;
            setError(typeof msg === "string" ? msg : "회원가입에 실패했습니다.");
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
                    <CardDescription>새 계정을 만드세요</CardDescription>
                </CardHeader>

                <CardContent>
                    {error && (
                        <div className="bg-destructive/8 text-destructive px-3 py-2 rounded-lg mb-4 text-xs">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="name" className="text-xs text-foreground/60">이름</Label>
                            <Input
                                id="name"
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-xs text-foreground/60">이메일</Label>
                            <Input
                                id="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-xs text-foreground/60">비밀번호</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                minLength={8}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="8자 이상"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-foreground/60">역할</Label>
                            <Select value={role} onValueChange={setRole}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="STUDENT">학생</SelectItem>
                                    <SelectItem value="TEACHER">교사</SelectItem>
                                    <SelectItem value="EXTERNAL">외부인</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            type="submit"
                            disabled={submitting}
                            className="w-full"
                        >
                            {submitting ? "가입 중..." : "회원가입"}
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="justify-center">
                    <p className="text-xs text-muted-foreground">
                        이미 계정이 있으신가요?{" "}
                        <Link
                            href="/login"
                            className="text-primary hover:underline font-medium"
                        >
                            로그인
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
