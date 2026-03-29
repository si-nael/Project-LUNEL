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
        setChoices([...choices, { name: "", outcomes: [{ probability: 1, score: 0 }] }]);
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
        updated[choiceIdx].outcomes = updated[choiceIdx].outcomes.filter((_, i) => i !== outcomeIdx);
        setChoices(updated);
    };

    const updateOutcome = (choiceIdx: number, outcomeIdx: number, field: "probability" | "score", value: number) => {
        const updated = [...choices];
        updated[choiceIdx].outcomes[outcomeIdx][field] = value;
        setChoices(updated);
    };

    const analyze = async () => {
        setLoading(true);
        setError("");
        setResult(null);
        try {
            const res = await api.post("/api/v1/analysis/expected-value", { choices });
            setResult(res.data);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { detail?: string } } };
            setError(axiosErr.response?.data?.detail || "분석 중 오류가 발생했습니다.");
        }
        setLoading(false);
    };

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">기댓값 분석</h1>
            <p className="text-sm text-gray-500 mb-6">선택지별 결과 확률과 점수를 입력하여 기댓값을 계산합니다.</p>

            <div className="space-y-6 mb-6">
                {choices.map((choice, cIdx) => (
                    <div key={cIdx} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <input
                                type="text"
                                placeholder={`선택지 ${cIdx + 1} 이름`}
                                value={choice.name}
                                onChange={(e) => updateChoiceName(cIdx, e.target.value)}
                                className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1"
                            />
                            {choices.length > 1 && (
                                <button onClick={() => removeChoice(cIdx)} className="text-red-500 text-sm">삭제</button>
                            )}
                        </div>

                        <div className="space-y-2">
                            {choice.outcomes.map((outcome, oIdx) => (
                                <div key={oIdx} className="flex items-center gap-2">
                                    <label className="text-xs text-gray-500 w-12">확률</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="1"
                                        value={outcome.probability}
                                        onChange={(e) => updateOutcome(cIdx, oIdx, "probability", Number(e.target.value))}
                                        className="border border-gray-300 rounded px-2 py-1 text-sm w-20"
                                    />
                                    <label className="text-xs text-gray-500 w-12">점수</label>
                                    <input
                                        type="number"
                                        value={outcome.score}
                                        onChange={(e) => updateOutcome(cIdx, oIdx, "score", Number(e.target.value))}
                                        className="border border-gray-300 rounded px-2 py-1 text-sm w-20"
                                    />
                                    {choice.outcomes.length > 1 && (
                                        <button onClick={() => removeOutcome(cIdx, oIdx)} className="text-red-400 text-xs">✕</button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button onClick={() => addOutcome(cIdx)} className="mt-2 text-xs text-blue-600 hover:underline">+ 결과 추가</button>
                    </div>
                ))}
            </div>

            <div className="flex gap-3 mb-8">
                <button onClick={addChoice} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">+ 선택지 추가</button>
                <button
                    onClick={analyze}
                    disabled={loading}
                    className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? "분석 중..." : "분석 실행"}
                </button>
            </div>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            {result && (
                <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h2 className="font-semibold text-blue-900 mb-2">추천</h2>
                        <p className="text-sm text-blue-800">{result.recommendation}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <h3 className="text-sm font-medium text-green-800">최고 기댓값</h3>
                            <p className="text-2xl font-bold text-green-900 mt-1">{result.best_expected_value.choice}</p>
                            <p className="text-sm text-green-700">EV = {result.best_expected_value.ev.toFixed(2)}</p>
                        </div>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <h3 className="text-sm font-medium text-yellow-800">안전한 선택</h3>
                            <p className="text-2xl font-bold text-yellow-900 mt-1">{result.safest_choice.choice}</p>
                            <p className="text-sm text-yellow-700">EV = {result.safest_choice.ev.toFixed(2)}, σ = {result.safest_choice.risk.toFixed(2)}</p>
                        </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left px-4 py-2">선택지</th>
                                    <th className="text-right px-4 py-2">기댓값</th>
                                    <th className="text-right px-4 py-2">분산</th>
                                    <th className="text-right px-4 py-2">표준편차</th>
                                    <th className="text-right px-4 py-2">범위</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.all_results.map((r, i) => (
                                    <tr key={i} className="border-t border-gray-100">
                                        <td className="px-4 py-2 font-medium">{r.choice}</td>
                                        <td className="px-4 py-2 text-right">{r.ev.toFixed(2)}</td>
                                        <td className="px-4 py-2 text-right">{r.variance.toFixed(2)}</td>
                                        <td className="px-4 py-2 text-right">{r.std_dev.toFixed(2)}</td>
                                        <td className="px-4 py-2 text-right">{r.range[0]} ~ {r.range[1]}</td>
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
