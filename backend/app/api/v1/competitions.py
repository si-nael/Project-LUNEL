from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.competition import Competition, Participant, Scoreboard, Submission
from app.models.enums import (
    EventStatus,
    NodeStatus,
    ParticipantStatus,
    ProblemStatus,
    SubmissionVerdict,
    UserRole,
)
from app.models.event import Event
from app.models.problem import CompetitionProblem, Problem
from app.models.user import User
from app.schemas.competition import (
    CompetitionCreate,
    CompetitionListItem,
    CompetitionResponse,
    CompetitionUpdate,
    GradeSubmission,
    JudgeSubmission,
    ParticipantResponse,
    ScoreboardResponse,
    SubmissionCreate,
    SubmissionResponse,
)
from app.schemas.problem import (
    CompetitionProblemCreate,
    CompetitionProblemResponse,
    CompetitionProblemUpdate,
)
from app.services.judging import judge_answer_submission
from app.services.scoreboard import build_scoreboard
from app.timeutils import as_utc

router = APIRouter()


def _is_privileged(user: User) -> bool:
    return user.role in (UserRole.ADMIN, UserRole.TEACHER)


def _require_operator(user: User) -> None:
    if not _is_privileged(user):
        raise HTTPException(status_code=403, detail="대회 운영 권한이 필요합니다")


async def _competition_or_404(db: AsyncSession, competition_id: UUID) -> Competition:
    competition = await db.get(Competition, competition_id)
    if competition is None:
        raise HTTPException(status_code=404, detail="Competition not found")
    return competition


@router.get("", response_model=list[CompetitionListItem])
async def list_competitions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    participant_counts = (
        select(
            Participant.competition_id.label("competition_id"),
            func.count(Participant.id).label("participant_count"),
        )
        .group_by(Participant.competition_id)
        .subquery()
    )
    problem_counts = (
        select(
            CompetitionProblem.competition_id.label("competition_id"),
            func.count(CompetitionProblem.id).label("problem_count"),
        )
        .group_by(CompetitionProblem.competition_id)
        .subquery()
    )
    result = await db.execute(
        select(
            Competition,
            Event,
            func.coalesce(participant_counts.c.participant_count, 0),
            func.coalesce(problem_counts.c.problem_count, 0),
        )
        .join(Event, Competition.event_id == Event.id)
        .outerjoin(
            participant_counts,
            participant_counts.c.competition_id == Competition.id,
        )
        .outerjoin(
            problem_counts,
            problem_counts.c.competition_id == Competition.id,
        )
        .order_by(Competition.created_at.desc())
    )
    return [
        CompetitionListItem(
            id=competition.id,
            event_id=competition.event_id,
            title=event.title,
            event_status=event.status.value,
            max_participants=competition.max_participants,
            participant_count=int(participant_count),
            problem_count=int(problem_count),
            scoring_rule=competition.scoring_rule,
            opens_at=competition.opens_at,
            closes_at=competition.closes_at,
            freeze_at=competition.freeze_at,
            scoreboard_public=competition.scoreboard_public,
            created_at=competition.created_at,
        )
        for competition, event, participant_count, problem_count in result.all()
    ]


@router.post("", response_model=CompetitionResponse, status_code=status.HTTP_201_CREATED)
async def create_competition(
    body: CompetitionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_operator(current_user)
    event = await db.get(Event, body.event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    competition = Competition(**body.model_dump())
    db.add(competition)
    await db.flush()
    await db.refresh(competition)
    return competition


@router.get("/{competition_id}", response_model=CompetitionResponse)
async def get_competition(
    competition_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _competition_or_404(db, competition_id)


@router.patch("/{competition_id}", response_model=CompetitionResponse)
async def update_competition(
    competition_id: UUID,
    body: CompetitionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_operator(current_user)
    competition = await _competition_or_404(db, competition_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(competition, key, value)
    await db.flush()
    await db.refresh(competition)
    return competition


# ── Problem releases ─────────────────────────────────────────


@router.get(
    "/{competition_id}/problems",
    response_model=list[CompetitionProblemResponse],
)
async def list_competition_problems(
    competition_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    competition = await _competition_or_404(db, competition_id)
    result = await db.execute(
        select(CompetitionProblem)
        .where(CompetitionProblem.competition_id == competition_id)
        .order_by(CompetitionProblem.order_index, CompetitionProblem.label)
    )
    releases = result.scalars().all()
    if _is_privileged(current_user):
        return releases
    now = datetime.now(timezone.utc)
    return [
        release
        for release in releases
        if (release.opens_at is None or as_utc(release.opens_at) <= now)
        and (release.closes_at is None or as_utc(release.closes_at) >= now)
        and (
            competition.event.status
            in (EventStatus.IN_PROGRESS, EventStatus.JUDGING, EventStatus.COMPLETED)
        )
        and (
            release.workflow_node_id is None
            or release.workflow_node.status == NodeStatus.DONE
        )
    ]


@router.post(
    "/{competition_id}/problems",
    response_model=CompetitionProblemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def attach_problem(
    competition_id: UUID,
    body: CompetitionProblemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_operator(current_user)
    await _competition_or_404(db, competition_id)
    problem = await db.get(Problem, body.problem_id)
    if problem is None:
        raise HTTPException(status_code=404, detail="Problem not found")
    if problem.status not in (ProblemStatus.READY, ProblemStatus.PUBLISHED):
        raise HTTPException(
            status_code=409,
            detail="검수를 마쳐 READY 또는 PUBLISHED 상태인 문제만 연결할 수 있습니다.",
        )
    release = CompetitionProblem(
        competition_id=competition_id,
        **body.model_dump(),
    )
    db.add(release)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=409,
            detail="이미 연결된 문제이거나 중복된 문제 라벨입니다",
        ) from exc
    await db.refresh(release)
    return release


@router.patch(
    "/{competition_id}/problems/{release_id}",
    response_model=CompetitionProblemResponse,
)
async def update_problem_release(
    competition_id: UUID,
    release_id: UUID,
    body: CompetitionProblemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_operator(current_user)
    release = await db.get(CompetitionProblem, release_id)
    if release is None or release.competition_id != competition_id:
        raise HTTPException(status_code=404, detail="Competition problem not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(release, key, value)
    await db.flush()
    await db.refresh(release)
    return release


@router.delete(
    "/{competition_id}/problems/{release_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def detach_problem(
    competition_id: UUID,
    release_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_operator(current_user)
    release = await db.get(CompetitionProblem, release_id)
    if release is None or release.competition_id != competition_id:
        raise HTTPException(status_code=404, detail="Competition problem not found")
    await db.delete(release)
    await db.flush()


# ── Participants ─────────────────────────────────────────────


@router.post(
    "/{competition_id}/participants",
    response_model=ParticipantResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_participant(
    competition_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    competition = await _competition_or_404(db, competition_id)
    existing = await db.execute(
        select(Participant).where(
            Participant.competition_id == competition_id,
            Participant.user_id == current_user.id,
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="이미 참가 신청했습니다")

    if competition.max_participants is not None:
        count = await db.scalar(
            select(func.count(Participant.id)).where(
                Participant.competition_id == competition.id,
                Participant.status != ParticipantStatus.WITHDRAWN,
            )
        )
        if int(count or 0) >= competition.max_participants:
            raise HTTPException(status_code=409, detail="Competition is full")

    participant = Participant(
        competition_id=competition.id,
        user_id=current_user.id,
    )
    db.add(participant)
    await db.flush()
    await db.refresh(participant)
    return participant


@router.get(
    "/{competition_id}/participants",
    response_model=list[ParticipantResponse],
)
async def list_participants(
    competition_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _competition_or_404(db, competition_id)
    result = await db.execute(
        select(Participant).where(Participant.competition_id == competition_id)
    )
    return result.scalars().all()


# ── Submissions / judging ────────────────────────────────────


@router.post(
    "/{competition_id}/submissions",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_submission(
    competition_id: UUID,
    body: SubmissionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    competition = await _competition_or_404(db, competition_id)
    participant_result = await db.execute(
        select(Participant).where(
            Participant.competition_id == competition_id,
            Participant.user_id == current_user.id,
        )
    )
    participant = participant_result.scalars().first()
    if participant is None:
        raise HTTPException(status_code=403, detail="Not a participant")

    release = None
    if body.competition_problem_id:
        release = await db.get(CompetitionProblem, body.competition_problem_id)
        if release is None or release.competition_id != competition_id:
            raise HTTPException(status_code=400, detail="잘못된 대회 문제입니다")
        now = datetime.now(timezone.utc)
        if release.opens_at and now < as_utc(release.opens_at):
            raise HTTPException(status_code=409, detail="아직 공개되지 않은 문제입니다")
        if release.closes_at and now > as_utc(release.closes_at):
            raise HTTPException(status_code=409, detail="제출이 마감된 문제입니다")
        if (
            release.workflow_node_id is not None
            and release.workflow_node.status != NodeStatus.DONE
            and not _is_privileged(current_user)
        ):
            raise HTTPException(
                status_code=409,
                detail="선행 워크플로가 완료되지 않아 아직 제출할 수 없습니다.",
            )
    elif competition.problems:
        raise HTTPException(status_code=422, detail="제출할 문제를 선택해야 합니다")

    submission = Submission(
        competition_id=competition_id,
        participant_id=participant.id,
        competition_problem_id=body.competition_problem_id,
        content=body.content,
        language=body.language,
        source_code=body.source_code,
        verdict=(
            SubmissionVerdict.QUEUED
            if body.source_code
            else SubmissionVerdict.PENDING
        ),
    )
    db.add(submission)
    await db.flush()
    if release is not None:
        await judge_answer_submission(db, submission, release)
    await db.refresh(submission)
    return submission


@router.get(
    "/{competition_id}/submissions",
    response_model=list[SubmissionResponse],
)
async def list_submissions(
    competition_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Submission).where(Submission.competition_id == competition_id)
    if not _is_privileged(current_user):
        stmt = stmt.join(
            Participant, Submission.participant_id == Participant.id
        ).where(Participant.user_id == current_user.id)
    result = await db.execute(stmt.order_by(Submission.submitted_at.desc()))
    return result.scalars().all()


@router.patch(
    "/{competition_id}/submissions/{submission_id}/grade",
    response_model=SubmissionResponse,
)
async def grade_submission(
    competition_id: UUID,
    submission_id: UUID,
    body: GradeSubmission,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_operator(current_user)
    submission = await db.get(Submission, submission_id)
    if submission is None or submission.competition_id != competition_id:
        raise HTTPException(status_code=404, detail="Submission not found")
    submission.score = body.score
    max_score = Decimal("100")
    if submission.competition_problem_id is not None:
        release = await db.get(
            CompetitionProblem, submission.competition_problem_id
        )
        if release is not None:
            max_score = Decimal(release.points)
    submission.verdict = (
        SubmissionVerdict.ACCEPTED
        if body.score >= max_score
        else SubmissionVerdict.PARTIAL
    )
    submission.graded_at = datetime.now(timezone.utc)
    submission.judged_at = submission.graded_at
    await db.flush()
    await db.refresh(submission)
    return submission


@router.patch(
    "/{competition_id}/submissions/{submission_id}/judge",
    response_model=SubmissionResponse,
)
async def record_judge_result(
    competition_id: UUID,
    submission_id: UUID,
    body: JudgeSubmission,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_operator(current_user)
    submission = await db.get(Submission, submission_id)
    if submission is None or submission.competition_id != competition_id:
        raise HTTPException(status_code=404, detail="Submission not found")
    try:
        submission.verdict = SubmissionVerdict(body.verdict)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="잘못된 verdict입니다") from exc
    for field in (
        "score",
        "penalty",
        "execution_time_ms",
        "memory_kb",
        "judge_message",
        "result_detail",
    ):
        setattr(submission, field, getattr(body, field))
    submission.judged_at = datetime.now(timezone.utc)
    submission.graded_at = submission.judged_at
    await db.flush()
    await db.refresh(submission)
    return submission


# ── Scoreboard projections / snapshots ───────────────────────


@router.get("/{competition_id}/scoreboard/live")
async def get_live_scoreboard(
    competition_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    competition = await _competition_or_404(db, competition_id)
    if not competition.scoreboard_public and not _is_privileged(current_user):
        raise HTTPException(status_code=403, detail="비공개 스코어보드입니다")
    return await build_scoreboard(
        db,
        competition,
        include_frozen=_is_privileged(current_user),
    )


@router.post(
    "/{competition_id}/scoreboard",
    response_model=ScoreboardResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_scoreboard(
    competition_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_operator(current_user)
    competition = await _competition_or_404(db, competition_id)
    snapshot = await build_scoreboard(db, competition, include_frozen=True)
    scoreboard = Scoreboard(
        competition_id=competition_id,
        snapshot_data=snapshot,
        is_final=competition.event.status == EventStatus.COMPLETED,
    )
    db.add(scoreboard)
    await db.flush()
    await db.refresh(scoreboard)
    return scoreboard


@router.get(
    "/{competition_id}/scoreboard",
    response_model=ScoreboardResponse | None,
)
async def get_latest_scoreboard(
    competition_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    competition = await _competition_or_404(db, competition_id)
    if not competition.scoreboard_public and not _is_privileged(current_user):
        raise HTTPException(status_code=403, detail="비공개 스코어보드입니다")
    result = await db.execute(
        select(Scoreboard)
        .where(Scoreboard.competition_id == competition_id)
        .order_by(Scoreboard.created_at.desc())
        .limit(1)
    )
    return result.scalars().first()
