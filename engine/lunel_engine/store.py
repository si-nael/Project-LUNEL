import json
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class EngineStore:
    def __init__(self, path: str):
        self.path = str(Path(path).resolve())
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self.initialize()

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    @contextmanager
    def session(self):
        connection = self.connect()
        try:
            yield connection
        finally:
            connection.close()

    def initialize(self) -> None:
        with self._lock, self.session() as db:
            db.executescript(
                """
                PRAGMA journal_mode = WAL;
                CREATE TABLE IF NOT EXISTS problems (
                    id TEXT PRIMARY KEY,
                    slug TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    statement TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    checker TEXT NOT NULL,
                    default_points REAL NOT NULL,
                    expected_answer TEXT,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS runtimes (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    state TEXT NOT NULL,
                    wrong_penalty_minutes INTEGER NOT NULL,
                    freeze_at TEXT,
                    started_at TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS runtime_problems (
                    id TEXT PRIMARY KEY,
                    runtime_id TEXT NOT NULL REFERENCES runtimes(id) ON DELETE CASCADE,
                    problem_id TEXT NOT NULL REFERENCES problems(id),
                    label TEXT NOT NULL,
                    points REAL NOT NULL,
                    order_index INTEGER NOT NULL,
                    UNIQUE(runtime_id, problem_id),
                    UNIQUE(runtime_id, label)
                );
                CREATE TABLE IF NOT EXISTS participants (
                    id TEXT PRIMARY KEY,
                    runtime_id TEXT NOT NULL REFERENCES runtimes(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    external_key TEXT,
                    created_at TEXT NOT NULL,
                    UNIQUE(runtime_id, external_key)
                );
                CREATE TABLE IF NOT EXISTS submissions (
                    id TEXT PRIMARY KEY,
                    runtime_id TEXT NOT NULL REFERENCES runtimes(id) ON DELETE CASCADE,
                    runtime_problem_id TEXT NOT NULL REFERENCES runtime_problems(id),
                    participant_id TEXT NOT NULL REFERENCES participants(id),
                    payload_json TEXT,
                    language TEXT,
                    source_code TEXT,
                    verdict TEXT NOT NULL,
                    score REAL NOT NULL,
                    penalty INTEGER NOT NULL,
                    judge_message TEXT,
                    submitted_at TEXT NOT NULL,
                    judged_at TEXT
                );
                """
            )

    def all(self, query: str, params: tuple = ()) -> list[dict]:
        with self._lock, self.session() as db:
            return [dict(row) for row in db.execute(query, params).fetchall()]

    def one(self, query: str, params: tuple = ()) -> dict | None:
        with self._lock, self.session() as db:
            row = db.execute(query, params).fetchone()
            return dict(row) if row else None

    def execute(self, query: str, params: tuple = ()) -> None:
        with self._lock, self.session() as db:
            db.execute(query, params)
            db.commit()

    def create_problem(self, payload: dict) -> dict:
        identifier = str(uuid.uuid4())
        now = utc_now()
        self.execute(
            """
            INSERT INTO problems
            (id, slug, title, statement, kind, checker, default_points,
             expected_answer, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                identifier,
                payload["slug"],
                payload["title"],
                payload["statement"],
                payload["kind"],
                payload["checker"],
                payload["default_points"],
                payload.get("expected_answer"),
                payload["status"],
                now,
                now,
            ),
        )
        return self.get_problem(identifier)

    def list_problems(self) -> list[dict]:
        return self.all("SELECT * FROM problems ORDER BY updated_at DESC")

    def get_problem(self, problem_id: str) -> dict | None:
        return self.one("SELECT * FROM problems WHERE id = ?", (problem_id,))

    def update_problem(self, problem_id: str, changes: dict) -> dict | None:
        if not changes:
            return self.get_problem(problem_id)
        changes["updated_at"] = utc_now()
        columns = ", ".join(f"{key} = ?" for key in changes)
        self.execute(
            f"UPDATE problems SET {columns} WHERE id = ?",
            (*changes.values(), problem_id),
        )
        return self.get_problem(problem_id)

    def create_runtime(self, payload: dict) -> dict:
        identifier = str(uuid.uuid4())
        now = utc_now()
        with self._lock, self.session() as db:
            db.execute(
                """
                INSERT INTO runtimes
                (id, title, mode, state, wrong_penalty_minutes, created_at, updated_at)
                VALUES (?, ?, ?, 'DRAFT', ?, ?, ?)
                """,
                (
                    identifier,
                    payload["title"],
                    payload["mode"],
                    payload["wrong_penalty_minutes"],
                    now,
                    now,
                ),
            )
            for order_index, release in enumerate(payload["problems"]):
                problem = db.execute(
                    "SELECT * FROM problems WHERE id = ?", (release["problem_id"],)
                ).fetchone()
                if problem is None:
                    raise ValueError("존재하지 않는 문제입니다.")
                if problem["status"] != "READY":
                    raise ValueError("READY 상태의 문제만 대회에 연결할 수 있습니다.")
                db.execute(
                    """
                    INSERT INTO runtime_problems
                    (id, runtime_id, problem_id, label, points, order_index)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(uuid.uuid4()),
                        identifier,
                        problem["id"],
                        release["label"].upper(),
                        release.get("points") or problem["default_points"],
                        order_index,
                    ),
                )
            db.commit()
        return self.get_runtime(identifier)

    def list_runtimes(self) -> list[dict]:
        runtimes = self.all("SELECT * FROM runtimes ORDER BY created_at DESC")
        return [self.decorate_runtime(runtime) for runtime in runtimes]

    def get_runtime(self, runtime_id: str) -> dict | None:
        runtime = self.one("SELECT * FROM runtimes WHERE id = ?", (runtime_id,))
        return self.decorate_runtime(runtime) if runtime else None

    def decorate_runtime(self, runtime: dict) -> dict:
        runtime = dict(runtime)
        runtime["problems"] = self.runtime_problems(runtime["id"])
        runtime["participant_count"] = self.one(
            "SELECT COUNT(*) AS count FROM participants WHERE runtime_id = ?",
            (runtime["id"],),
        )["count"]
        runtime["submission_count"] = self.one(
            "SELECT COUNT(*) AS count FROM submissions WHERE runtime_id = ?",
            (runtime["id"],),
        )["count"]
        return runtime

    def runtime_problems(self, runtime_id: str) -> list[dict]:
        return self.all(
            """
            SELECT rp.*, p.slug, p.title, p.statement, p.kind, p.checker
            FROM runtime_problems rp
            JOIN problems p ON p.id = rp.problem_id
            WHERE rp.runtime_id = ?
            ORDER BY rp.order_index, rp.label
            """,
            (runtime_id,),
        )

    def update_runtime_state(
        self,
        runtime_id: str,
        state: str,
        *,
        freeze_at: str | None,
        started_at: str | None,
    ) -> dict:
        self.execute(
            """
            UPDATE runtimes
            SET state = ?, freeze_at = ?, started_at = COALESCE(?, started_at),
                updated_at = ?
            WHERE id = ?
            """,
            (state, freeze_at, started_at, utc_now(), runtime_id),
        )
        return self.get_runtime(runtime_id)

    def create_participant(self, runtime_id: str, payload: dict) -> dict:
        identifier = str(uuid.uuid4())
        self.execute(
            """
            INSERT INTO participants
            (id, runtime_id, name, external_key, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                identifier,
                runtime_id,
                payload["name"],
                payload.get("external_key") or identifier,
                utc_now(),
            ),
        )
        return self.one("SELECT * FROM participants WHERE id = ?", (identifier,))

    def participants(self, runtime_id: str) -> list[dict]:
        return self.all(
            "SELECT * FROM participants WHERE runtime_id = ? ORDER BY created_at",
            (runtime_id,),
        )

    def create_submission(self, payload: dict) -> dict:
        identifier = str(uuid.uuid4())
        submitted_at = utc_now()
        self.execute(
            """
            INSERT INTO submissions
            (id, runtime_id, runtime_problem_id, participant_id, payload_json,
             language, source_code, verdict, score, penalty, judge_message,
             submitted_at, judged_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
            """,
            (
                identifier,
                payload["runtime_id"],
                payload["runtime_problem_id"],
                payload["participant_id"],
                json.dumps({"answer": payload.get("answer")}, ensure_ascii=False),
                payload.get("language"),
                payload.get("source_code"),
                payload["verdict"],
                payload["score"],
                payload.get("judge_message"),
                submitted_at,
                submitted_at if payload["verdict"] != "QUEUED" else None,
            ),
        )
        return self.get_submission(identifier)

    def get_submission(self, submission_id: str) -> dict | None:
        return self.one(
            "SELECT * FROM submissions WHERE id = ?", (submission_id,)
        )

    def submissions(self, runtime_id: str) -> list[dict]:
        return self.all(
            """
            SELECT * FROM submissions
            WHERE runtime_id = ?
            ORDER BY submitted_at
            """,
            (runtime_id,),
        )

    def judge_submission(self, submission_id: str, payload: dict) -> dict:
        self.execute(
            """
            UPDATE submissions
            SET verdict = ?, score = ?, penalty = ?, judge_message = ?,
                judged_at = ?
            WHERE id = ?
            """,
            (
                payload["verdict"],
                payload["score"],
                payload["penalty"],
                payload.get("message"),
                utc_now(),
                submission_id,
            ),
        )
        return self.get_submission(submission_id)
