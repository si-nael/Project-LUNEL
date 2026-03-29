"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

interface Outcome {
    probability: number;
    score: number;
}

interface ChoiceInput {
    name: string;
    outcomes: Outcome[];
}

interface AnalysisResult {
    best_expected_value: { choice: string; ev: number; risk: number };
    safest_choice: { choice: string; ev: number; risk: number };
    recommendation: string;
    all_results: {
        choice: string;
        ev: number;
        variance: number;
        std_dev: number;
        range: number[];
    }[];
}

export default function AnalysisPage() {
    const { user } = useAuth();
    const [choices, setChoices] = useState<ChoiceInput[]>([
        { name: "", outcomes: [{ probability: 1, score: 0 }] },
    ]);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const addChoice = () => {
        setChoices([
            ...choices,
            { name: "", outcomes: [{ probability: 1, score: 0 }] },
        ]);
    };

    const removeChoice = (idx: number) => {
        setChoices(choices.filter((_, i) => i !== idx));
    };

    const updateChoiceName = (idx: number, name: string) => {
        const updated = [...choices];
        updated[idx].name = name;
        setChoices(updated);
    };

    const addOutcome = (choiceIdx: number) => {
        const updated = [...choices];
        updated[choiceIdx].outcomes.push({ probability: 0, score: 0 });
        setChoices(updated);
    };

    const removeOutcome = (choiceIdx: number, outcomeIdx: number) => {
        const updated = [...choices];
        updated[choiceIdx].outcomes = updated[choiceIdx].outcomes.filter(
            (_, i) => i !== outcomeIdx
        );
        setChoices(updated);
    };

    const updateOutcome = (
        choiceIdx: number,
        outcomeIdx: number,
        field: "probability" | "score",
        value: number
    ) => {
        const updated = [...choices];
        updated[choiceIdx].outcomes[outcomeIdx][field] = value;
        setChoices(updated);
    };

    const analyze = async () => {
        setLoading(true);
        setError("");
        setResult(null);
        try {
            const res = await api.post("/analysis/expected-value", {
                choices,
            });
            setResult(res.data);
        } catch (err: unknown) {
            const axiosErr = err as {
                response?: { data?: { detail?: string } };
            };
            setError(
                axiosErr.response?.data?.detail || "분석 오류가 발생했습니다."
            );
        }
        setLoading(false);
    };

    return (
        <div>
            <h1 className="text-xl font-semibold tracking-tight mb-1">
                기댓값 분석
            </h1>
            <p className="text-xs text-muted-foreground mb-6">
                선택지별 결과 확률과 점수를 입력하여 기댓값을 계산합니다.
            </p>

            <div className="space-y-4 mb-6">
                {choices.map((choice, cIdx) => (
                    <div key={cIdx} className="glass rounded-2xl p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <input
                                type="text"
                                placeholder={`선택지 ${cIdx + 1} 이름`}
                                value={choice.name}
                                onChange={(e) =>
                                    updateChoiceName(cIdx, e.target.value)
                                }
                                className="border border-border/60 bg-transparent rounded-xl px-3 py-1.5 text-xs flex-1 focus:outline-none focus:ring-1 focus:ring-ring/40"
                            />
                            {choices.length > 1 && (
                                <button
                                    onClick={() => removeChoice(cIdx)}
                                    className="text-destructive text-xs hover:underline"
                                >
                                    삭제
                                </button>
                            )}
                        </div>

                        <div className="space-y-2">
                            {choice.outcomes.map((outcome, oIdx) => (
                                <div key={oIdx} className="flex items-center gap-2">
                                    <label className="text-[11px] text-muted-foreground w-8">
                                        확률
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="1"
                                        value={outcome.probability}
                                        onChange={(e) =>
                                            updateOutcome(
                                                cIdx,
                                                oIdx,
                                                "probability",
                                                Number(e.target.value)
                                            )
                                        }
                                        className="border border-border/60 bg-transparent rounded-lg px-2 py-1 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-ring/40"
                                    />
                                    <label className="text-[11px] text-muted-foreground w-8">
                                        점수
                                    </label>
                                    <input
                                        type="number"
                                        value={outcome.score}
                                        onChange={(e) =>
                                            updateOutcome(
                                                cIdx,
                                                oIdx,
                                                "score",
                                                Number(e.target.value)
                                            )
                                        }
                                        className="border border-border/60 bg-transparent rounded-lg px-2 py-1 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-ring/40"
                                    />
                                    {choice.outcomes.length > 1 && (
                                        <button
                                            onClick={() =>
                                                removeOutcome(cIdx, oIdx)
                                            }
                                            className="text-destructive/60 text-xs hover:text-destructive"
                                        >
                                            &times;
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => addOutcome(cIdx)}
                            className="mt-2 text-[11px] text-primary hover:underline"
                        >
                            + 결과 추가
                        </button>
                    </div>
                ))}
            </div>

            <div className="flex gap-3 mb-8">
                <button
                    onClick={addChoice}
                    className="px-4 py-2 text-xs border border-border/60 rounded-xl hover:bg-foreground/[0.03] transition-all"
                >
                    + 선택지 추가
                </button>
                <button
                    onClick={analyze}
                    disabled={loading}
                    className="px-5 py-2 text-xs bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-all"
                >
                    {loading ? "분석 중..." : "분석 실행"}
                </button>
            </div>

            {error && (
                <p className="text-destructive text-xs mb-4">{error}</p>
            )}

            {result && (
                <div className="space-y-4">
                    <div className="bg-primary/5 rounded-xl p-4">
                        <h2 className="text-xs font-semibold text-primary mb-1">
                            추천
                        </h2>
                        <p className="text-xs text-primary/80">
                            {result.recommendation}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-emerald-500/5 rounded-xl p-4">
                            <h3 className="text-[11px] font-medium text-emerald-600">
                                최고 기댓값
                            </h3>
                            <p className="text-lg font-semibold text-emerald-700 mt-1">
                                {result.best_expected_value.choice}
                            </p>
                            <p className="text-xs text-emerald-600">
                                EV = {result.best_expected_value.ev.toFixed(2)}
                            </p>
                        </div>
                        <div className="bg-amber-500/5 rounded-xl p-4">
                            <h3 className="text-[11px] font-medium text-amber-600">
                                안전한 선택
                            </h3>
                            <p className="text-lg font-semibold text-amber-700 mt-1">
                                {result.safest_choice.choice}
                            </p>
                            <p className="text-xs text-amber-600">
                                EV = {result.safest_choice.ev.toFixed(2)}, σ ={" "}
                                {result.safest_choice.risk.toFixed(2)}
                            </p>
                        </div>
                    </div>

                    <div className="glass rounded-2xl overflow-hidden">
                        <table className="w-full text-xs">
                            <thead className="bg-foreground/[0.03]">
                                <tr>
                                    <th className="text-left px-4 py-2.5 font-medium">
                                        선택지
                                    </th>
                                    <th className="text-right px-4 py-2.5 font-medium">
                                        기댓값
                                    </th>
                                    <th className="text-right px-4 py-2.5 font-medium">
                                        분산
                                    </th>
                                    <th className="text-right px-4 py-2.5 font-medium">
                                        표준편차
                                    </th>
                                    <th className="text-right px-4 py-2.5 font-medium">
                                        범위
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.all_results.map((r, i) => (
                                    <tr
                                        key={i}
                                        className="border-t border-border/30"
                                    >
                                        <td className="px-4 py-2.5 font-medium">
                                            {r.choice}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            {r.ev.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            {r.variance.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            {r.std_dev.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            {r.range[0]} ~ {r.range[1]}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
