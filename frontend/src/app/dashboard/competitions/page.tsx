"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Competition } from "@/types";

export default function CompetitionsPage() {
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(false);
    }, []);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-semibold tracking-tight">대회 / 경연</h1>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
            ) : (
                <div className="glass rounded-2xl p-8 text-center">
                    <h2 className="text-base font-semibold text-foreground mb-2">
                        대회 관리
                    </h2>
                    <p className="text-sm text-muted-foreground mb-6">
                        이벤트에 연결된 대회를 생성하고 참가자 제출과 채점, 순위표를
                        관리할 수 있습니다.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-2xl mx-auto">
                        <div className="bg-foreground/[0.03] rounded-xl p-4">
                            <div className="text-sm font-medium text-foreground mb-1">
                                참가자 등록
                            </div>
                            <p className="text-xs text-muted-foreground">
                                인원 제한 설정 및 참가 신청 관리
                            </p>
                        </div>
                        <div className="bg-foreground/[0.03] rounded-xl p-4">
                            <div className="text-sm font-medium text-foreground mb-1">
                                제출 &amp; 채점
                            </div>
                            <p className="text-xs text-muted-foreground">
                                과제 제출, 점수 부여 및 피드백
                            </p>
                        </div>
                        <div className="bg-foreground/[0.03] rounded-xl p-4">
                            <div className="text-sm font-medium text-foreground mb-1">
                                순위표
                            </div>
                            <p className="text-xs text-muted-foreground">
                                실시간 스냅샷 기반 순위 집계
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
