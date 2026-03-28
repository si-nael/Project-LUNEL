from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.competition import (
    Competition, Participant, Submission, Scoreboard,
)
from app.models.enums import ParticipantStatus
from app.models.user import User
from app.schemas.competition import (
    CompetitionCreate, CompetitionResponse,
    ParticipantResponse,
    SubmissionCreate, SubmissionResponse, GradeSubmission,
    ScoreboardResponse,
)

router = APIRouter()

# ── Competition CRUD ──────────────────────────────────────────


@router.post("", response_model=CompetitionResponse, status_code=status.HTTP_201_CREATED)
async def create_competition(
    body: CompetitionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comp = Competition(
        event_id=body.event_id,
        max_participants=body.max_participants,
        scoring_rule=body.scoring_rule,
    )
    db.add(comp)
    await db.flush()
    await db.refresh(comp)
    return comp


@router.get("/{competition_id}", response_model=CompetitionResponse)
async def get_competition(
    competition_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comp = await db.get(Competition, competition_id)
    if comp is None:
        raise HTTPException(status_code=404, detail="Competition not found")
    return comp


# ── Participants ──────────────────────────────────────────────


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
    comp = await db.get(Competition, competition_id)
    if comp is None:
        raise HTTPException(status_code=404, detail="Competition not found")

    # Check capacity
    if comp.max_participants is not None:
        count_res = await db.execute(
            select(Participant).where(Participant.competition_id == comp.id)
        )
        if len(count_res.scalars().all()) >= comp.max_participants:
            raise HTTPException(status_code=409, detail="Competition is full")

    participant = Participant(
        competition_id=comp.id,
        user_id=current_user.id,
    )
    db.add(participant)
    await db.flush()
    await db.refresh(participant)
    return participant


@router.get("/{competition_id}/participants", response_model=list[ParticipantResponse])
async def list_participants(
    competition_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Participant).where(Participant.competition_id == competition_id)
    )
    return result.scalars().all()


# ── Submissions ───────────────────────────────────────────────


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
    # Ensure user is a participant
    result = await db.execute(
        select(Participant).where(
            Participant.competition_id == competition_id,
            Participant.user_id == current_user.id,
        )
    )
    participant = result.scalars().first()
    if participant is None:
        raise HTTPException(status_code=403, detail="Not a participant")

    sub = Submission(
        competition_id=competition_id,
        participant_id=participant.id,
        content=body.content,
    )
    db.add(sub)
    await db.flush()
    await db.refresh(sub)
    return sub


@router.get("/{competition_id}/submissions", response_model=list[SubmissionResponse])
async def list_submissions(
    competition_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Submission).where(Submission.competition_id == competition_id)
    )
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
    sub = await db.get(Submission, submission_id)
    if sub is None or sub.competition_id != competition_id:
        raise HTTPException(status_code=404, detail="Submission not found")

    sub.score = body.score
    sub.graded_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(sub)
    return sub


# ── Scoreboard ────────────────────────────────────────────────


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
    # Gather graded submissions and build snapshot
    result = await db.execute(
        select(Submission).where(
            Submission.competition_id == competition_id,
            Submission.score.isnot(None),
        )
    )
    submissions = result.scalars().all()

    snapshot: list[dict] = []
    for s in submissions:
        snapshot.append(
            {"participant_id": str(s.participant_id), "score": float(s.score)}
        )
    snapshot.sort(key=lambda x: x["score"], reverse=True)

    # Assign ranks
    for i, entry in enumerate(snapshot, start=1):
        entry["rank"] = i

    scoreboard = Scoreboard(
        competition_id=competition_id,
        snapshot_data={"rankings": snapshot},
        is_final=False,
    )
    db.add(scoreboard)
    await db.flush()
    await db.refresh(scoreboard)
    return scoreboard


@router.get("/{competition_id}/scoreboard", response_model=ScoreboardResponse | None)
async def get_latest_scoreboard(
    competition_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Scoreboard)
        .where(Scoreboard.competition_id == competition_id)
        .order_by(Scoreboard.created_at.desc())
        .limit(1)
    )
    return result.scalars().first()
