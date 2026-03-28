"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Competition } from "@/types";

export default function CompetitionsPage() {
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // For now we don't have a list endpoint; show empty state
        // The competitions API is per-ID; we'll show a search/create interface
        setLoading(false);
    }, []);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">대회 / 경연</h1>
            </div>

            {loading ? (
                <p className="text-gray-400">로딩 중...</p>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <div className="text-4xl mb-4">🏆</div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">
                        대회 관리
                    </h2>
                    <p className="text-sm text-gray-500 mb-6">
                        이벤트에 연결된 대회를 생성하고 참가자, 제출물, 채점, 순위표를
                        관리할 수 있습니다.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-2xl mx-auto">
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="text-sm font-medium text-gray-900 mb-1">
                                참가자 등록
                            </div>
                            <p className="text-xs text-gray-500">
                                인원 제한 설정 및 참가 신청 관리
                            </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="text-sm font-medium text-gray-900 mb-1">
                                제출 & 채점
                            </div>
                            <p className="text-xs text-gray-500">
                                과제 제출, 점수 부여 및 피드백
                            </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="text-sm font-medium text-gray-900 mb-1">
                                순위표
                            </div>
                            <p className="text-xs text-gray-500">
                                실시간 스냅샷 기반 순위 집계
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
