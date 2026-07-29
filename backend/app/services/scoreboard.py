"""Live scoreboard projection for IOI/score-based and ICPC contests."""
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.competition import Competition, Participant, Submission
from app.models.enums import SubmissionVerdict
from app.models.problem import CompetitionProblem
from app.models.user import User
from app.timeutils import as_utc


async def build_scoreboard(
    db: AsyncSession,
    competition: Competition,
    *,
    include_frozen: bool,
) -> dict:
    participant_result = await db.execute(
        select(Participant, User)
        .join(User, Participant.user_id == User.id)
        .where(Participant.competition_id == competition.id)
    )
    participant_rows = participant_result.all()

    releases_result = await db.execute(
        select(CompetitionProblem)
        .where(CompetitionProblem.competition_id == competition.id)
        .order_by(CompetitionProblem.order_index, CompetitionProblem.label)
    )
    releases = releases_result.scalars().all()

    submissions_result = await db.execute(
        select(Submission)
        .where(Submission.competition_id == competition.id)
        .order_by(Submission.submitted_at)
    )
    submissions = submissions_result.scalars().all()

    freeze_at = as_utc(competition.freeze_at)
    visible_submissions: list[Submission] = []
    hidden_by_participant: dict[UUID, int] = defaultdict(int)
    for submission in submissions:
        if (
            freeze_at is not None
            and not include_frozen
            and as_utc(submission.submitted_at) > freeze_at
        ):
            hidden_by_participant[submission.participant_id] += 1
            continue
        visible_submissions.append(submission)

    mode = str((competition.scoring_rule or {}).get("mode", "IOI")).upper()
    wrong_penalty = int((competition.scoring_rule or {}).get("wrong_penalty_minutes", 20))
    starts_at = as_utc(competition.opens_at or competition.created_at)

    by_participant_problem: dict[tuple[UUID, UUID], list[Submission]] = defaultdict(list)
    for submission in visible_submissions:
        if submission.competition_problem_id is not None:
            by_participant_problem[
                (submission.participant_id, submission.competition_problem_id)
            ].append(submission)

    rows: list[dict] = []
    for participant, user in participant_rows:
        problems: dict[str, dict] = {}
        total_score = Decimal("0")
        solved = 0
        total_penalty = 0
        last_improvement: datetime | None = None

        for release in releases:
            attempts = by_participant_problem.get((participant.id, release.id), [])
            accepted_index: int | None = None
            best_score = Decimal("0")
            best_submission: Submission | None = None

            for index, submission in enumerate(attempts):
                score = Decimal(submission.score or 0)
                if score > best_score or best_submission is None:
                    best_score = score
                    best_submission = submission
                if (
                    accepted_index is None
                    and submission.verdict == SubmissionVerdict.ACCEPTED
                ):
                    accepted_index = index

            if mode == "ICPC":
                if accepted_index is not None:
                    accepted = attempts[accepted_index]
                    wrong_before = sum(
                        1
                        for attempt in attempts[:accepted_index]
                        if attempt.verdict
                        not in (
                            SubmissionVerdict.PENDING,
                            SubmissionVerdict.QUEUED,
                            SubmissionVerdict.RUNNING,
                            SubmissionVerdict.COMPILE_ERROR,
                        )
                    )
                    elapsed = max(
                        0,
                        int(
                            (
                                as_utc(accepted.submitted_at) - starts_at
                            ).total_seconds()
                            // 60
                        ),
                    )
                    penalty = elapsed + wrong_before * wrong_penalty
                    solved += 1
                    total_penalty += penalty
                    last_improvement = max(
                        filter(None, [last_improvement, accepted.submitted_at])
                    )
                    problems[release.label] = {
                        "solved": True,
                        "attempts": accepted_index + 1,
                        "penalty": penalty,
                        "score": float(release.points),
                    }
                else:
                    problems[release.label] = {
                        "solved": False,
                        "attempts": len(attempts),
                        "penalty": 0,
                        "score": 0,
                    }
            else:
                total_score += best_score
                if best_score >= Decimal(release.points):
                    solved += 1
                if best_submission and best_score > 0:
                    last_improvement = max(
                        filter(None, [last_improvement, best_submission.submitted_at])
                    )
                problems[release.label] = {
                    "solved": best_score >= Decimal(release.points),
                    "attempts": len(attempts),
                    "score": float(best_score),
                    "max_score": float(release.points),
                    "verdict": (
                        best_submission.verdict.value if best_submission else None
                    ),
                }

        rows.append(
            {
                "participant_id": str(participant.id),
                "user_id": str(user.id),
                "name": user.name,
                "team_name": getattr(participant, "team_name", None),
                "score": float(total_score) if mode != "ICPC" else solved,
                "solved": solved,
                "penalty": total_penalty,
                "last_improvement_at": (
                    last_improvement.isoformat() if last_improvement else None
                ),
                "problems": problems,
                "frozen_submissions": hidden_by_participant.get(participant.id, 0),
            }
        )

    if mode == "ICPC":
        rows.sort(key=lambda row: (-row["solved"], row["penalty"], row["name"]))
    else:
        rows.sort(
            key=lambda row: (
                -row["score"],
                row["last_improvement_at"] or "9999",
                row["name"],
            )
        )

    previous_key = None
    rank = 0
    for index, row in enumerate(rows, start=1):
        key = (
            (row["solved"], row["penalty"])
            if mode == "ICPC"
            else (row["score"], row["last_improvement_at"])
        )
        if key != previous_key:
            rank = index
            previous_key = key
        row["rank"] = rank

    return {
        "competition_id": str(competition.id),
        "mode": mode,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "frozen": freeze_at is not None and not include_frozen,
        "freeze_at": freeze_at.isoformat() if freeze_at else None,
        "problems": [
            {
                "id": str(release.id),
                "label": release.label,
                "title": release.title_override or release.problem.title,
                "points": float(release.points),
            }
            for release in releases
        ],
        "rankings": rows,
    }
