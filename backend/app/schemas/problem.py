from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class ProblemCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=120, pattern=r"^[a-z0-9][a-z0-9-]*$")
    title: str = Field(min_length=1, max_length=300)
    statement_md: str = ""
    input_format_md: str = ""
    output_format_md: str = ""
    constraints_md: str = ""
    notes_md: str = ""
    time_limit_ms: int = Field(2000, ge=100, le=60000)
    memory_limit_mb: int = Field(512, ge=16, le=4096)
    checker_type: str = "TOKENS"
    scoring_mode: str = "BINARY"
    difficulty: int | None = Field(None, ge=0, le=5000)
    visibility_policy_id: UUID | None = None


class ProblemUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    statement_md: str | None = None
    input_format_md: str | None = None
    output_format_md: str | None = None
    constraints_md: str | None = None
    notes_md: str | None = None
    time_limit_ms: int | None = Field(None, ge=100, le=60000)
    memory_limit_mb: int | None = Field(None, ge=16, le=4096)
    checker_type: str | None = None
    scoring_mode: str | None = None
    status: str | None = None
    difficulty: int | None = Field(None, ge=0, le=5000)
    visibility_policy_id: UUID | None = None


class ProblemResponse(BaseModel):
    id: UUID
    slug: str
    title: str
    statement_md: str
    input_format_md: str
    output_format_md: str
    constraints_md: str
    notes_md: str
    time_limit_ms: int
    memory_limit_mb: int
    checker_type: str
    scoring_mode: str
    status: str
    difficulty: int | None
    version: int
    created_by: UUID
    visibility_policy_id: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProblemTestCaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    input_data: str = ""
    expected_output: str = ""
    is_sample: bool = False
    points: Decimal | None = Field(None, ge=0)
    order_index: int = 0
    metadata_json: dict | None = None


class ProblemTestCaseUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    input_data: str | None = None
    expected_output: str | None = None
    is_sample: bool | None = None
    points: Decimal | None = Field(None, ge=0)
    order_index: int | None = None
    metadata_json: dict | None = None


class ProblemTestCaseResponse(BaseModel):
    id: UUID
    group_id: UUID
    name: str
    input_data: str
    expected_output: str
    is_sample: bool
    points: Decimal | None
    order_index: int
    metadata_json: dict | None

    model_config = {"from_attributes": True}


class ProblemTestGroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    points: Decimal = Field(Decimal("100"), ge=0)
    order_index: int = 0
    dependency_group_ids: list[UUID] = Field(default_factory=list)
    scoring_policy: dict | None = None


class ProblemTestGroupUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    points: Decimal | None = Field(None, ge=0)
    order_index: int | None = None
    dependency_group_ids: list[UUID] | None = None
    scoring_policy: dict | None = None


class ProblemTestGroupResponse(BaseModel):
    id: UUID
    problem_id: UUID
    name: str
    points: Decimal
    order_index: int
    dependency_group_ids: list
    scoring_policy: dict | None
    test_cases: list[ProblemTestCaseResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class ProblemSolutionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    language: str = Field(min_length=1, max_length=50)
    source_code: str = Field(min_length=1)
    expected_complexity: str | None = Field(None, max_length=120)
    is_reference: bool = False


class ProblemSolutionResponse(BaseModel):
    id: UUID
    problem_id: UUID
    title: str
    language: str
    source_code: str
    expected_complexity: str | None
    is_reference: bool
    author_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class ProblemRevisionCreate(BaseModel):
    note: str | None = Field(None, max_length=500)


class ProblemRevisionResponse(BaseModel):
    id: UUID
    problem_id: UUID
    version: int
    snapshot_data: dict
    note: str | None
    created_by: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class ProblemPackageResponse(ProblemResponse):
    test_groups: list[ProblemTestGroupResponse] = Field(default_factory=list)
    solutions: list[ProblemSolutionResponse] = Field(default_factory=list)
    revisions: list[ProblemRevisionResponse] = Field(default_factory=list)


class CompetitionProblemCreate(BaseModel):
    problem_id: UUID
    label: str = Field(min_length=1, max_length=20)
    title_override: str | None = Field(None, max_length=300)
    points: Decimal = Field(Decimal("100"), ge=0)
    order_index: int = 0
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    workflow_node_id: UUID | None = None
    scoring_config: dict | None = None


class CompetitionProblemUpdate(BaseModel):
    label: str | None = Field(None, min_length=1, max_length=20)
    title_override: str | None = Field(None, max_length=300)
    points: Decimal | None = Field(None, ge=0)
    order_index: int | None = None
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    workflow_node_id: UUID | None = None
    scoring_config: dict | None = None


class CompetitionProblemResponse(BaseModel):
    id: UUID
    competition_id: UUID
    problem_id: UUID
    label: str
    title_override: str | None
    points: Decimal
    order_index: int
    opens_at: datetime | None
    closes_at: datetime | None
    workflow_node_id: UUID | None
    scoring_config: dict | None
    problem: ProblemResponse

    model_config = {"from_attributes": True}
