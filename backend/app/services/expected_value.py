"""Expected value prediction for competition/event choices.

Admin-only analysis module.
Input: choices, scoring rules, past participation data.
Output: expected value, variance, recommended strategy.
"""
import math
from dataclasses import dataclass


@dataclass
class Choice:
    name: str
    outcomes: list[dict]  # [{"probability": 0.3, "score": 100}, ...]


@dataclass
class AnalysisResult:
    choice_name: str
    expected_value: float
    variance: float
    std_dev: float
    min_score: float
    max_score: float


def analyze_choice(choice: Choice) -> AnalysisResult:
    """Compute expected value and variance for a single choice."""
    ev = sum(o["probability"] * o["score"] for o in choice.outcomes)
    variance = sum(
        o["probability"] * (o["score"] - ev) ** 2 for o in choice.outcomes
    )
    scores = [o["score"] for o in choice.outcomes]
    return AnalysisResult(
        choice_name=choice.name,
        expected_value=round(ev, 4),
        variance=round(variance, 4),
        std_dev=round(math.sqrt(variance), 4),
        min_score=min(scores) if scores else 0,
        max_score=max(scores) if scores else 0,
    )


def analyze_choices(choices: list[Choice]) -> list[AnalysisResult]:
    """Analyze multiple choices and return sorted by expected value desc."""
    results = [analyze_choice(c) for c in choices]
    results.sort(key=lambda r: r.expected_value, reverse=True)
    return results


def recommend_strategy(results: list[AnalysisResult]) -> dict:
    """Recommend strategy based on analysis results."""
    if not results:
        return {"recommendation": "데이터 없음", "details": []}

    best_ev = results[0]

    # Find lowest variance among top choices (within 10% of best EV)
    threshold = best_ev.expected_value * 0.9
    safe_choices = [r for r in results if r.expected_value >= threshold]
    safest = min(safe_choices, key=lambda r: r.variance) if safe_choices else best_ev

    return {
        "best_expected_value": {
            "choice": best_ev.choice_name,
            "ev": best_ev.expected_value,
            "risk": best_ev.std_dev,
        },
        "safest_choice": {
            "choice": safest.choice_name,
            "ev": safest.expected_value,
            "risk": safest.std_dev,
        },
        "recommendation": (
            f"최고 기댓값: {best_ev.choice_name} (EV={best_ev.expected_value:.2f}). "
            f"안전한 선택: {safest.choice_name} (EV={safest.expected_value:.2f}, σ={safest.std_dev:.2f})."
        ),
        "all_results": [
            {
                "choice": r.choice_name,
                "ev": r.expected_value,
                "variance": r.variance,
                "std_dev": r.std_dev,
                "range": [r.min_score, r.max_score],
            }
            for r in results
        ],
    }
