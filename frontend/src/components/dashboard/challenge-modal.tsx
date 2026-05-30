"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    CheckCircle,
    Clock,
    Lock,
    Loader2,
    RefreshCw,
    Shield,
    XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Challenge } from "@/types";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── Props ────────────────────────────────────────────────────

interface ChallengeModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    policyId: string;
    onSuccess: () => void;
    targetTitle?: string;
    theme?: "default" | "cyberpunk";
}

// ── Constants ────────────────────────────────────────────────

const CHALLENGE_TYPE_LABELS: Record<Challenge["challenge_type"], string> = {
    MATH: "수학",
    TEXT: "텍스트",
    LOGIC: "논리",
};

const CHALLENGE_TYPE_COLORS: Record<Challenge["challenge_type"], string> = {
    MATH: "bg-blue-500/10 text-blue-400",
    TEXT: "bg-amber-500/10 text-amber-400",
    LOGIC: "bg-violet-500/10 text-violet-400",
};

type ModalPhase = "loading" | "challenge" | "success" | "failed" | "expired";

// ── Helpers ──────────────────────────────────────────────────

function formatCountdown(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// ── Component ────────────────────────────────────────────────

export default function ChallengeModal({
    open,
    onOpenChange,
    policyId,
    onSuccess,
    targetTitle,
    theme = "default",
}: ChallengeModalProps) {
    const [phase, setPhase] = useState<ModalPhase>("loading");
    const [challenge, setChallenge] = useState<Challenge | null>(null);
    const [answer, setAnswer] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [shake, setShake] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Fetch challenge ──────────────────────────────────────

    const fetchChallenge = useCallback(async () => {
        setPhase("loading");
        setAnswer("");
        setShake(false);

        try {
            const { data } = await api.post<Challenge>("/challenges", {
                visibility_policy_id: policyId,
            });
            setChallenge(data);
            setPhase("challenge");

            const expiresAt = new Date(data.expires_at).getTime();
            const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
            setRemainingSeconds(remaining);
        } catch {
            toast.error("챌린지를 불러올 수 없습니다.");
            onOpenChange(false);
        }
    }, [policyId, onOpenChange]);

    // ── Lifecycle: fetch on open ─────────────────────────────

    useEffect(() => {
        if (open) {
            fetchChallenge();
        } else {
            setChallenge(null);
            setPhase("loading");
            setAnswer("");
            setShake(false);
        }
    }, [open, fetchChallenge]);

    // ── Countdown timer ──────────────────────────────────────

    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current);

        if (phase !== "challenge" || remainingSeconds <= 0) return;

        timerRef.current = setInterval(() => {
            setRemainingSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    setPhase("expired");
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [phase, remainingSeconds]);

    // ── Auto-focus input ─────────────────────────────────────

    useEffect(() => {
        if (phase === "challenge") {
            const timeout = setTimeout(() => inputRef.current?.focus(), 150);
            return () => clearTimeout(timeout);
        }
    }, [phase]);

    // ── Submit answer ────────────────────────────────────────

    const handleSubmit = async () => {
        if (!challenge || !answer.trim() || submitting) return;

        setSubmitting(true);

        try {
            await api.post(`/challenges/${challenge.id}/verify`, {
                answer: answer.trim(),
            });
            setPhase("success");
            toast.success("인증에 성공했습니다!");
            setTimeout(() => onSuccess(), 1200);
        } catch (error: unknown) {
            const err = error as { response?: { status?: number; data?: { detail?: string } } };
            const status = err.response?.status;

            const detail = err.response?.data?.detail;
            const isExpired = typeof detail === "string" && detail.includes("expired");
            if (status === 410 || isExpired) {
                setPhase("expired");
                toast.error("챌린지 시간이 만료되었습니다.");
            } else {
                // Wrong answer – update attempts
                setChallenge((prev) => {
                    if (!prev) return prev;
                    const updated = { ...prev, attempts: prev.attempts + 1 };
                    if (updated.attempts >= updated.max_attempts) {
                        setPhase("failed");
                        toast.error("최대 시도 횟수를 초과했습니다.");
                    } else {
                        const detail = err.response?.data?.detail;
                        const msg = Array.isArray(detail) ? detail[0]?.msg : detail;
                        toast.error(typeof msg === "string" ? msg : "답이 틀렸습니다. 다시 시도하세요.");
                    }
                    return updated;
                });

                // Shake animation
                setShake(true);
                setTimeout(() => setShake(false), 500);
                setAnswer("");
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleSubmit();
        }
    };

    // ── Derived state ────────────────────────────────────────

    const remainingAttempts = challenge
        ? challenge.max_attempts - challenge.attempts
        : 0;

    const isTimeLow = remainingSeconds > 0 && remainingSeconds <= 30;

    const isCyberpunk = theme === "cyberpunk";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn(
                "max-w-md p-0 overflow-hidden",
                isCyberpunk ? "bg-zinc-950/95 border border-green-500/30 text-green-400 font-mono shadow-[0_0_30px_rgba(34,197,94,0.15)]" : ""
            )}>
                {/* ── Header ──────────────────────────────── */}
                <DialogHeader className={cn(
                    "px-6 pt-6 pb-4 border-b",
                    isCyberpunk ? "border-green-500/30" : "border-border/50"
                )}>
                    <div className="flex items-center gap-2.5 mb-2">
                        <div className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-xl",
                            isCyberpunk ? "bg-green-500/10" : "bg-primary/10"
                        )}>
                            <Shield className={cn(
                                "h-4.5 w-4.5",
                                isCyberpunk ? "text-green-400" : "text-primary"
                            )} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <DialogTitle className={cn(
                                "text-sm",
                                isCyberpunk && "uppercase tracking-widest"
                            )}>
                                {isCyberpunk ? "SYSTEM_ACCESS_PROTOCOL" : "접근 인증 챌린지"}
                            </DialogTitle>
                            <DialogDescription className={cn(
                                "text-xs truncate",
                                isCyberpunk && "text-green-500/70 uppercase"
                            )}>
                                {targetTitle
                                    ? `TARGET: ${targetTitle}`
                                    : "보호된 콘텐츠에 접근하려면 챌린지를 풀어야 합니다."}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* ── Body ────────────────────────────────── */}
                <div className="px-6 py-5">
                    {/* Loading */}
                    {phase === "loading" && (
                        <div className="flex flex-col items-center justify-center gap-3 py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">챌린지 생성 중...</p>
                        </div>
                    )}

                    {/* Active challenge */}
                    {phase === "challenge" && challenge && (
                        <div className="space-y-5">
                            {/* Type badge + timer */}
                            <div className="flex items-center justify-between">
                                <Badge
                                    className={cn(
                                        "px-2.5 py-1",
                                        CHALLENGE_TYPE_COLORS[challenge.challenge_type]
                                    )}
                                >
                                    {CHALLENGE_TYPE_LABELS[challenge.challenge_type]}
                                </Badge>

                                <div
                                    className={cn(
                                        "flex items-center gap-1.5 text-xs font-mono tabular-nums",
                                        isTimeLow
                                            ? "text-destructive animate-pulse"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    <Clock className="h-3.5 w-3.5" />
                                    {formatCountdown(remainingSeconds)}
                                </div>
                            </div>

                            {/* Question */}
                            <div className={cn(
                                "rounded-xl p-4 border",
                                isCyberpunk 
                                    ? "bg-green-950/20 border-green-500/30 text-green-300" 
                                    : "bg-foreground/[0.03] border-border/40"
                            )}>
                                <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
                                    {challenge.challenge_data.question}
                                </p>
                                {challenge.challenge_data.hint && (
                                    <p className="mt-2.5 text-xs text-muted-foreground/80 italic">
                                        💡 힌트: {challenge.challenge_data.hint}
                                    </p>
                                )}
                            </div>

                            {/* Answer input */}
                            <div className="space-y-2.5">
                                <div
                                    className={cn(
                                        "transition-transform",
                                        shake && "animate-[shake_0.4s_ease-in-out]"
                                    )}
                                    style={
                                        shake
                                            ? {
                                                animation:
                                                    "shake 0.4s ease-in-out",
                                            }
                                            : undefined
                                    }
                                >
                                    <Input
                                        ref={inputRef}
                                        value={answer}
                                        onChange={(e) => setAnswer(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={isCyberpunk ? "> INPUT_VALUE..." : "정답을 입력하세요"}
                                        className={cn(
                                            "h-11 text-sm",
                                            isCyberpunk && "bg-black/50 border-green-500/30 focus-visible:ring-green-500/50 text-green-400 placeholder:text-green-700 font-mono"
                                        )}
                                        disabled={submitting}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className={cn(
                                        "text-[11px]",
                                        isCyberpunk ? "text-green-600 uppercase" : "text-muted-foreground"
                                    )}>
                                        남은 시도:{" "}
                                        <span
                                            className={cn(
                                                "font-semibold",
                                                remainingAttempts <= 1
                                                    ? "text-destructive"
                                                    : isCyberpunk ? "text-green-400" : "text-foreground"
                                            )}
                                        >
                                            {remainingAttempts}
                                        </span>
                                        /{challenge.max_attempts}
                                    </span>

                                    <Button
                                        onClick={handleSubmit}
                                        disabled={!answer.trim() || submitting}
                                        size="sm"
                                        className={cn(
                                            "min-w-[80px]",
                                            isCyberpunk && "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/50"
                                        )}
                                    >
                                        {submitting ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            "제출"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Success */}
                    {phase === "success" && (
                        <div className="flex flex-col items-center justify-center gap-4 py-10">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 animate-[scaleIn_0.4s_ease-out]">
                                <CheckCircle className="h-8 w-8 text-emerald-500" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold">인증 성공!</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    접근 권한이 확인되었습니다.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Failed */}
                    {phase === "failed" && (
                        <div className="flex flex-col items-center justify-center gap-4 py-10">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                                <XCircle className="h-8 w-8 text-destructive" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold">인증 실패</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    최대 시도 횟수를 초과했습니다.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchChallenge}
                                className="mt-2 gap-1.5"
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                                새 챌린지 요청
                            </Button>
                        </div>
                    )}

                    {/* Expired */}
                    {phase === "expired" && (
                        <div className="flex flex-col items-center justify-center gap-4 py-10">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
                                <Clock className="h-8 w-8 text-amber-500" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold">시간 만료</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    챌린지 제한 시간이 초과되었습니다.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchChallenge}
                                className="mt-2 gap-1.5"
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                                새 챌린지 요청
                            </Button>
                        </div>
                    )}
                </div>

                {/* ── Footer ─────────────────────────────── */}
                <div className={cn(
                    "flex items-center justify-between border-t px-6 py-3 text-[11px]",
                    isCyberpunk ? "border-green-500/30 text-green-600" : "border-border/50 text-muted-foreground"
                )}>
                    <div className="flex items-center gap-1.5">
                        <Lock className="h-3 w-3" />
                        <span>{isCyberpunk ? "SECURE_CONNECTION_ESTABLISHED" : "Procedural Key 인증"}</span>
                    </div>
                    {phase === "challenge" && (
                        <span>Enter 키로 제출</span>
                    )}
                </div>

            </DialogContent>
        </Dialog>
    );
}

