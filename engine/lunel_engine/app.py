import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status

from .domain import build_scoreboard, compare_answer, transition_state
from .schemas import (
    JudgeResult,
    ParticipantCreate,
    ProblemCreate,
    ProblemUpdate,
    RuntimeCommand,
    RuntimeCreate,
    SubmissionCreate,
)
from .store import EngineStore


def create_app(
    *,
    database_path: str | None = None,
    token: str | None = None,
) -> FastAPI:
    resolved_path = database_path or os.getenv(
        "LUNEL_ENGINE_DB",
        str(Path(__file__).resolve().parents[1] / "data" / "lunel-engine.db"),
    )
    engine_token = token or os.getenv("LUNEL_ENGINE_TOKEN", "local-lunel-engine")
    store = EngineStore(resolved_path)
    app = FastAPI(
        title="Lunel Engine",
        version="1.0.0",
        description="Standalone authoritative runtime for Lunel Web.",
    )
    app.state.store = store
    app.state.engine_token = engine_token

    async def authorize(x_lunel_token: str | None = Header(None)) -> None:
        if x_lunel_token != app.state.engine_token:
            raise HTTPException(status_code=401, detail="Invalid engine token")

    def runtime_or_404(runtime_id: str) -> dict:
        runtime = store.get_runtime(runtime_id)
        if runtime is None:
            raise HTTPException(status_code=404, detail="Runtime not found")
        return runtime

    @app.get("/health")
    async def health():
        return {
            "status": "ok",
            "engine": "LUNEL",
            "version": "1.0.0",
            "database": store.path,
        }

    @app.get("/v1/problems", dependencies=[Depends(authorize)])
    async def list_problems():
        return store.list_problems()

    @app.get("/v1/problems/{problem_id}", dependencies=[Depends(authorize)])
    async def get_problem(problem_id: str):
        problem = store.get_problem(problem_id)
        if problem is None:
            raise HTTPException(status_code=404, detail="Problem not found")
        return problem

    @app.post(
        "/v1/problems",
        status_code=status.HTTP_201_CREATED,
        dependencies=[Depends(authorize)],
    )
    async def create_problem(body: ProblemCreate):
        if body.status == "READY" and body.kind == "ANSWER" and not body.expected_answer:
            raise HTTPException(
                status_code=409,
                detail="An ANSWER problem needs an expected answer before it can be READY.",
            )
        try:
            return store.create_problem(body.model_dump())
        except sqlite3.IntegrityError as exc:
            raise HTTPException(
                status_code=409,
                detail="Problem slug is already in use.",
            ) from exc

    @app.patch("/v1/problems/{problem_id}", dependencies=[Depends(authorize)])
    async def update_problem(problem_id: str, body: ProblemUpdate):
        problem = store.get_problem(problem_id)
        if problem is None:
            raise HTTPException(status_code=404, detail="Problem not found")
        changes = body.model_dump(exclude_unset=True)
        target = {**problem, **changes}
        if (
            target["status"] == "READY"
            and target["kind"] == "ANSWER"
            and not target.get("expected_answer")
        ):
            raise HTTPException(
                status_code=409,
                detail="An ANSWER problem needs an expected answer before it can be READY.",
            )
        return store.update_problem(problem_id, changes)

    @app.get("/v1/runtimes", dependencies=[Depends(authorize)])
    async def list_runtimes():
        return store.list_runtimes()

    @app.post(
        "/v1/runtimes",
        status_code=status.HTTP_201_CREATED,
        dependencies=[Depends(authorize)],
    )
    async def create_runtime(body: RuntimeCreate):
        try:
            return store.create_runtime(body.model_dump())
        except (ValueError, sqlite3.IntegrityError) as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.get("/v1/runtimes/{runtime_id}", dependencies=[Depends(authorize)])
    async def get_runtime(runtime_id: str):
        return runtime_or_404(runtime_id)

    @app.post(
        "/v1/runtimes/{runtime_id}/commands",
        dependencies=[Depends(authorize)],
    )
    async def command_runtime(runtime_id: str, body: RuntimeCommand):
        runtime = runtime_or_404(runtime_id)
        try:
            target = transition_state(runtime["state"], body.command)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        now = datetime.now(timezone.utc).isoformat()
        freeze_at = runtime["freeze_at"]
        started_at = now if body.command == "START" else None
        if body.command == "FREEZE":
            freeze_at = now
        if body.command in ("UNFREEZE", "RESET"):
            freeze_at = None
        return store.update_runtime_state(
            runtime_id,
            target,
            freeze_at=freeze_at,
            started_at=started_at,
        )

    @app.get(
        "/v1/runtimes/{runtime_id}/participants",
        dependencies=[Depends(authorize)],
    )
    async def list_participants(runtime_id: str):
        runtime_or_404(runtime_id)
        return store.participants(runtime_id)

    @app.post(
        "/v1/runtimes/{runtime_id}/participants",
        status_code=status.HTTP_201_CREATED,
        dependencies=[Depends(authorize)],
    )
    async def create_participant(runtime_id: str, body: ParticipantCreate):
        runtime = runtime_or_404(runtime_id)
        if runtime["state"] not in ("REGISTRATION", "RUNNING", "FROZEN"):
            raise HTTPException(
                status_code=409,
                detail="Participants cannot be registered in the current state.",
            )
        try:
            return store.create_participant(runtime_id, body.model_dump())
        except sqlite3.IntegrityError as exc:
            raise HTTPException(
                status_code=409,
                detail="Participant is already registered.",
            ) from exc

    @app.get(
        "/v1/runtimes/{runtime_id}/submissions",
        dependencies=[Depends(authorize)],
    )
    async def list_submissions(runtime_id: str):
        runtime_or_404(runtime_id)
        return store.submissions(runtime_id)

    @app.post(
        "/v1/runtimes/{runtime_id}/submissions",
        status_code=status.HTTP_201_CREATED,
        dependencies=[Depends(authorize)],
    )
    async def create_submission(runtime_id: str, body: SubmissionCreate):
        runtime = runtime_or_404(runtime_id)
        if runtime["state"] not in ("RUNNING", "FROZEN"):
            raise HTTPException(
                status_code=409,
                detail="Runtime is not accepting submissions.",
            )
        participant = store.one(
            "SELECT * FROM participants WHERE id = ? AND runtime_id = ?",
            (body.participant_id, runtime_id),
        )
        release = store.one(
            """
            SELECT rp.*, p.kind, p.checker, p.expected_answer
            FROM runtime_problems rp
            JOIN problems p ON p.id = rp.problem_id
            WHERE rp.id = ? AND rp.runtime_id = ?
            """,
            (body.runtime_problem_id, runtime_id),
        )
        if participant is None or release is None:
            raise HTTPException(
                status_code=422,
                detail="Participant or runtime problem does not belong to this runtime.",
            )

        verdict = "QUEUED"
        score = 0.0
        message = "Waiting for an external judge or operator decision."
        if release["kind"] == "ANSWER":
            accepted, message = compare_answer(
                body.answer or "",
                release["expected_answer"] or "",
                release["checker"],
            )
            verdict = "ACCEPTED" if accepted else "WRONG_ANSWER"
            score = float(release["points"]) if accepted else 0.0
        return store.create_submission(
            {
                **body.model_dump(),
                "runtime_id": runtime_id,
                "verdict": verdict,
                "score": score,
                "judge_message": message,
            }
        )

    @app.patch(
        "/v1/runtimes/{runtime_id}/submissions/{submission_id}",
        dependencies=[Depends(authorize)],
    )
    async def judge_submission(
        runtime_id: str,
        submission_id: str,
        body: JudgeResult,
    ):
        runtime_or_404(runtime_id)
        submission = store.get_submission(submission_id)
        if submission is None or submission["runtime_id"] != runtime_id:
            raise HTTPException(status_code=404, detail="Submission not found")
        return store.judge_submission(submission_id, body.model_dump())

    @app.get(
        "/v1/runtimes/{runtime_id}/scoreboard",
        dependencies=[Depends(authorize)],
    )
    async def scoreboard(
        runtime_id: str,
        include_frozen: bool = Query(False),
    ):
        runtime = runtime_or_404(runtime_id)
        return build_scoreboard(
            runtime,
            runtime["problems"],
            store.participants(runtime_id),
            store.submissions(runtime_id),
            include_frozen=include_frozen,
        )

    return app


app = create_app()
