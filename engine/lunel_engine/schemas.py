from typing import Literal

from pydantic import BaseModel, Field


ProblemKind = Literal["ANSWER", "CODE", "MANUAL"]
CheckerType = Literal["EXACT", "TOKENS", "FLOAT"]
RuntimeMode = Literal["IOI", "ICPC"]
RuntimeState = Literal[
    "DRAFT",
    "REGISTRATION",
    "RUNNING",
    "FROZEN",
    "FINISHED",
    "CANCELLED",
]


class ProblemCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=120, pattern=r"^[a-z0-9][a-z0-9-]*$")
    title: str = Field(min_length=1, max_length=300)
    statement: str = ""
    kind: ProblemKind = "ANSWER"
    checker: CheckerType = "TOKENS"
    default_points: float = Field(100, ge=0)
    expected_answer: str | None = None
    status: Literal["DRAFT", "READY"] = "DRAFT"


class ProblemUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    statement: str | None = None
    kind: ProblemKind | None = None
    checker: CheckerType | None = None
    default_points: float | None = Field(None, ge=0)
    expected_answer: str | None = None
    status: Literal["DRAFT", "READY"] | None = None


class RuntimeProblemInput(BaseModel):
    problem_id: str
    label: str = Field(min_length=1, max_length=20)
    points: float | None = Field(None, ge=0)


class RuntimeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    mode: RuntimeMode = "IOI"
    wrong_penalty_minutes: int = Field(20, ge=0)
    problems: list[RuntimeProblemInput] = Field(min_length=1)


class RuntimeCommand(BaseModel):
    command: Literal[
        "OPEN_REGISTRATION",
        "START",
        "FREEZE",
        "UNFREEZE",
        "FINISH",
        "CANCEL",
        "RESET",
    ]


class ParticipantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    external_key: str | None = Field(None, max_length=200)


class SubmissionCreate(BaseModel):
    participant_id: str
    runtime_problem_id: str
    answer: str | None = None
    source_code: str | None = None
    language: str | None = Field(None, max_length=40)


class JudgeResult(BaseModel):
    verdict: Literal[
        "ACCEPTED",
        "PARTIAL",
        "WRONG_ANSWER",
        "TIME_LIMIT",
        "MEMORY_LIMIT",
        "RUNTIME_ERROR",
        "COMPILE_ERROR",
        "JUDGE_ERROR",
    ]
    score: float = Field(0, ge=0)
    penalty: int = Field(0, ge=0)
    message: str | None = Field(None, max_length=1000)
