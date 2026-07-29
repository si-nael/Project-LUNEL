from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.enums import (
    CheckerType,
    ProblemScoringMode,
    ProblemStatus,
    UserRole,
)
from app.models.problem import (
    Problem,
    ProblemRevision,
    ProblemSolution,
    ProblemTestCase,
    ProblemTestGroup,
)
from app.models.user import User
from app.schemas.problem import (
    ProblemCreate,
    ProblemPackageResponse,
    ProblemResponse,
    ProblemRevisionCreate,
    ProblemRevisionResponse,
    ProblemSolutionCreate,
    ProblemSolutionResponse,
    ProblemTestCaseCreate,
    ProblemTestCaseResponse,
    ProblemTestCaseUpdate,
    ProblemTestGroupCreate,
    ProblemTestGroupResponse,
    ProblemTestGroupUpdate,
    ProblemUpdate,
)

router = APIRouter()

PROBLEM_STATUS_TRANSITIONS = {
    ProblemStatus.DRAFT: {ProblemStatus.REVIEW, ProblemStatus.ARCHIVED},
    ProblemStatus.REVIEW: {
        ProblemStatus.DRAFT,
        ProblemStatus.READY,
        ProblemStatus.ARCHIVED,
    },
    ProblemStatus.READY: {
        ProblemStatus.REVIEW,
        ProblemStatus.PUBLISHED,
        ProblemStatus.ARCHIVED,
    },
    ProblemStatus.PUBLISHED: {ProblemStatus.READY, ProblemStatus.ARCHIVED},
    ProblemStatus.ARCHIVED: {ProblemStatus.DRAFT},
}


def _is_editor(user: User) -> bool:
    return user.role in (UserRole.ADMIN, UserRole.TEACHER)


def _require_editor(user: User) -> None:
    if not _is_editor(user):
        raise HTTPException(status_code=403, detail="문제 제작 권한이 필요합니다.")


def _snapshot(problem: Problem) -> dict:
    return {
        "slug": problem.slug,
        "title": problem.title,
        "statement_md": problem.statement_md,
        "input_format_md": problem.input_format_md,
        "output_format_md": problem.output_format_md,
        "constraints_md": problem.constraints_md,
        "notes_md": problem.notes_md,
        "time_limit_ms": problem.time_limit_ms,
        "memory_limit_mb": problem.memory_limit_mb,
        "checker_type": problem.checker_type.value,
        "scoring_mode": problem.scoring_mode.value,
        "status": problem.status.value,
        "difficulty": problem.difficulty,
    }


async def _get_problem_or_404(db: AsyncSession, problem_id: UUID) -> Problem:
    problem = await db.get(Problem, problem_id)
    if problem is None:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem


async def _snapshot_current_version(
    db: AsyncSession,
    problem: Problem,
    user: User,
    *,
    note: str | None,
) -> ProblemRevision:
    revision = await db.scalar(
        select(ProblemRevision).where(
            ProblemRevision.problem_id == problem.id,
            ProblemRevision.version == problem.version,
        )
    )
    if revision is None:
        revision = ProblemRevision(
            problem_id=problem.id,
            version=problem.version,
            snapshot_data=_snapshot(problem),
            note=note,
            created_by=user.id,
        )
        db.add(revision)
    elif note is not None:
        revision.note = note
    return revision


@router.get("", response_model=list[ProblemResponse])
async def list_problems(
    q: str | None = Query(None, max_length=120),
    problem_status: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Problem)
    if q:
        token = f"%{q}%"
        stmt = stmt.where(or_(Problem.title.ilike(token), Problem.slug.ilike(token)))
    if problem_status:
        try:
            stmt = stmt.where(Problem.status == ProblemStatus(problem_status))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="올바르지 않은 문제 상태입니다.") from exc
    if not _is_editor(current_user):
        stmt = stmt.where(Problem.status == ProblemStatus.PUBLISHED)
    result = await db.execute(stmt.order_by(Problem.updated_at.desc()))
    return result.scalars().all()


@router.post("", response_model=ProblemResponse, status_code=status.HTTP_201_CREATED)
async def create_problem(
    body: ProblemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_editor(current_user)
    try:
        problem = Problem(
            **body.model_dump(exclude={"checker_type", "scoring_mode"}),
            checker_type=CheckerType(body.checker_type),
            scoring_mode=ProblemScoringMode(body.scoring_mode),
            created_by=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.add(problem)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="이미 사용 중인 문제 slug입니다.") from exc
    await db.refresh(problem)
    return problem


@router.get("/{problem_id}", response_model=ProblemPackageResponse)
async def get_problem_package(
    problem_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    problem = await _get_problem_or_404(db, problem_id)
    if not _is_editor(current_user) and problem.status != ProblemStatus.PUBLISHED:
        raise HTTPException(status_code=403, detail="공개되지 않은 문제입니다.")
    if not _is_editor(current_user):
        # Public packages deliberately omit hidden tests, solutions, and
        # authoring history. CompetitionProblem exposes the same safe fields.
        return {
            **ProblemResponse.model_validate(problem).model_dump(),
            "test_groups": [],
            "solutions": [],
            "revisions": [],
        }
    return problem


@router.patch("/{problem_id}", response_model=ProblemResponse)
async def update_problem(
    problem_id: UUID,
    body: ProblemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_editor(current_user)
    problem = await _get_problem_or_404(db, problem_id)
    updates = body.model_dump(exclude_unset=True)
    try:
        if "checker_type" in updates:
            updates["checker_type"] = CheckerType(updates["checker_type"])
        if "scoring_mode" in updates:
            updates["scoring_mode"] = ProblemScoringMode(updates["scoring_mode"])
        if "status" in updates:
            updates["status"] = ProblemStatus(updates["status"])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    target_status = updates.get("status")
    if (
        target_status is not None
        and target_status != problem.status
        and target_status not in PROBLEM_STATUS_TRANSITIONS[problem.status]
    ):
        raise HTTPException(
            status_code=409,
            detail=f"{problem.status.value}에서 {target_status.value}(으)로 전환할 수 없습니다.",
        )

    statement = updates.get("statement_md", problem.statement_md)
    if target_status == ProblemStatus.PUBLISHED:
        if not statement.strip():
            raise HTTPException(status_code=409, detail="문제 본문이 비어 있습니다.")
        test_case = await db.scalar(
            select(ProblemTestCase)
            .join(ProblemTestGroup)
            .where(ProblemTestGroup.problem_id == problem.id)
            .limit(1)
        )
        if test_case is None:
            raise HTTPException(
                status_code=409,
                detail="공개하려면 최소 한 개의 검증 테스트가 필요합니다.",
            )

    await _snapshot_current_version(
        db,
        problem,
        current_user,
        note="자동 변경 전 스냅샷",
    )
    for key, value in updates.items():
        setattr(problem, key, value)
    problem.version += 1
    await db.flush()
    await db.refresh(problem)
    return problem


@router.delete("/{problem_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_problem(
    problem_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_editor(current_user)
    problem = await _get_problem_or_404(db, problem_id)
    problem.status = ProblemStatus.ARCHIVED
    await db.flush()


@router.post(
    "/{problem_id}/revisions",
    response_model=ProblemRevisionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_revision(
    problem_id: UUID,
    body: ProblemRevisionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_editor(current_user)
    problem = await _get_problem_or_404(db, problem_id)
    revision = await _snapshot_current_version(
        db, problem, current_user, note=body.note
    )
    await db.flush()
    await db.refresh(revision)
    return revision


@router.post(
    "/{problem_id}/test-groups",
    response_model=ProblemTestGroupResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_test_group(
    problem_id: UUID,
    body: ProblemTestGroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_editor(current_user)
    await _get_problem_or_404(db, problem_id)
    group = ProblemTestGroup(problem_id=problem_id, **body.model_dump(mode="json"))
    db.add(group)
    await db.flush()
    await db.refresh(group)
    return group


@router.patch("/test-groups/{group_id}", response_model=ProblemTestGroupResponse)
async def update_test_group(
    group_id: UUID,
    body: ProblemTestGroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_editor(current_user)
    group = await db.get(ProblemTestGroup, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Test group not found")
    for key, value in body.model_dump(exclude_unset=True, mode="json").items():
        setattr(group, key, value)
    await db.flush()
    await db.refresh(group)
    return group


@router.delete("/test-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_editor(current_user)
    group = await db.get(ProblemTestGroup, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Test group not found")
    await db.delete(group)
    await db.flush()


@router.post(
    "/test-groups/{group_id}/cases",
    response_model=ProblemTestCaseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_test_case(
    group_id: UUID,
    body: ProblemTestCaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_editor(current_user)
    group = await db.get(ProblemTestGroup, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Test group not found")
    test_case = ProblemTestCase(group_id=group_id, **body.model_dump())
    db.add(test_case)
    await db.flush()
    await db.refresh(test_case)
    return test_case


@router.patch("/test-cases/{case_id}", response_model=ProblemTestCaseResponse)
async def update_test_case(
    case_id: UUID,
    body: ProblemTestCaseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_editor(current_user)
    test_case = await db.get(ProblemTestCase, case_id)
    if test_case is None:
        raise HTTPException(status_code=404, detail="Test case not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(test_case, key, value)
    await db.flush()
    await db.refresh(test_case)
    return test_case


@router.delete("/test-cases/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test_case(
    case_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_editor(current_user)
    test_case = await db.get(ProblemTestCase, case_id)
    if test_case is None:
        raise HTTPException(status_code=404, detail="Test case not found")
    await db.delete(test_case)
    await db.flush()


@router.post(
    "/{problem_id}/solutions",
    response_model=ProblemSolutionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_solution(
    problem_id: UUID,
    body: ProblemSolutionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_editor(current_user)
    await _get_problem_or_404(db, problem_id)
    solution = ProblemSolution(
        problem_id=problem_id,
        author_id=current_user.id,
        **body.model_dump(),
    )
    db.add(solution)
    await db.flush()
    await db.refresh(solution)
    return solution


@router.delete("/solutions/{solution_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_solution(
    solution_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_editor(current_user)
    solution = await db.get(ProblemSolution, solution_id)
    if solution is None:
        raise HTTPException(status_code=404, detail="Solution not found")
    await db.delete(solution)
    await db.flush()
