"""Safe built-in judging helpers.

Lunel never executes untrusted source code inside the API process. Code
submissions are queued for an external sandbox adapter. The built-in judge is
limited to answer/output problems where comparison is deterministic.
"""
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.competition import Submission
from app.models.enums import CheckerType, SubmissionVerdict
from app.models.problem import CompetitionProblem, ProblemTestCase, ProblemTestGroup


def _tokens(value: str) -> list[str]:
    return value.strip().split()


def compare_output(
    actual: str,
    expected: str,
    checker_type: CheckerType,
    *,
    tolerance: float = 1e-6,
) -> tuple[bool, str]:
    if checker_type == CheckerType.EXACT:
        ok = actual.replace("\r\n", "\n").rstrip("\n") == expected.replace(
            "\r\n", "\n"
        ).rstrip("\n")
        return ok, "exact match" if ok else "output differs"

    if checker_type == CheckerType.TOKENS:
        ok = _tokens(actual) == _tokens(expected)
        return ok, "token match" if ok else "tokens differ"

    if checker_type == CheckerType.FLOAT:
        try:
            actual_values = [float(v) for v in _tokens(actual)]
            expected_values = [float(v) for v in _tokens(expected)]
        except ValueError:
            return False, "non-numeric token"
        if len(actual_values) != len(expected_values):
            return False, "different number of values"
        ok = all(
            abs(a - e) <= tolerance * max(1.0, abs(e))
            for a, e in zip(actual_values, expected_values)
        )
        return ok, "within tolerance" if ok else "outside tolerance"

    return False, "checker requires an external or manual judge"


async def judge_answer_submission(
    db: AsyncSession, submission: Submission, release: CompetitionProblem
) -> Submission:
    """Judge a short-answer/output submission without executing code."""
    problem = release.problem
    if submission.source_code:
        submission.verdict = SubmissionVerdict.QUEUED
        submission.judge_message = "외부 샌드박스 채점 대기"
        await db.flush()
        return submission

    if problem.checker_type in (
        CheckerType.SPECIAL,
        CheckerType.INTERACTIVE,
        CheckerType.MANUAL,
    ):
        submission.verdict = SubmissionVerdict.MANUAL_REVIEW
        submission.judge_message = "수동 또는 외부 채점이 필요한 문제"
        await db.flush()
        return submission

    answer = ""
    if submission.content:
        raw = submission.content.get("answer", submission.content.get("text", ""))
        answer = str(raw)

    case_result = await db.execute(
        select(ProblemTestCase)
        .join(ProblemTestGroup, ProblemTestCase.group_id == ProblemTestGroup.id)
        .where(ProblemTestGroup.problem_id == problem.id)
        .order_by(ProblemTestGroup.order_index, ProblemTestCase.order_index)
        .limit(1)
    )
    test_case = case_result.scalars().first()
    if test_case is None:
        submission.verdict = SubmissionVerdict.MANUAL_REVIEW
        submission.judge_message = "비교할 기준 답안이 없어 수동 채점으로 전환"
        await db.flush()
        return submission

    tolerance = 1e-6
    if release.scoring_config:
        tolerance = float(release.scoring_config.get("float_tolerance", tolerance))

    accepted, reason = compare_output(
        answer,
        test_case.expected_output,
        problem.checker_type,
        tolerance=tolerance,
    )
    submission.verdict = (
        SubmissionVerdict.ACCEPTED if accepted else SubmissionVerdict.WRONG_ANSWER
    )
    submission.score = release.points if accepted else Decimal("0")
    submission.judge_message = reason
    submission.result_detail = {
        "judge": "lunel-answer-judge",
        "checker": problem.checker_type.value,
        "case": test_case.name,
    }
    submission.judged_at = datetime.now(timezone.utc)
    submission.graded_at = submission.judged_at
    await db.flush()
    return submission
