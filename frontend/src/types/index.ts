export interface User {
    id: string;
    email: string;
    name: string;
    role: "STUDENT" | "TEACHER" | "ADMIN" | "EXTERNAL";
    class_info: string | null;
    is_active: boolean;
    created_at: string;
}

export interface Group {
    id: string;
    name: string;
    type:
    | "SCHOOL"
    | "GRADE"
    | "CLASS"
    | "CLUB"
    | "PROJECT_TEAM"
    | "TEMPORARY"
    | "STAFF";
    owner_user_id: string;
    is_temporary: boolean;
    expires_at: string | null;
    is_active: boolean;
    visibility_policy_id?: string | null;
    created_at: string;
    member_count: number;
}

export interface Schedule {
    id: string;
    title: string;
    description: string | null;
    type: "PROJECT" | "INTERVAL" | "EVENT";
    subtype: string;
    start_at: string;
    end_at: string | null;
    all_day: boolean;
    timezone: string;
    status: "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    importance_score: number;
    base_importance: number;
    authority_weight: number;
    urgency_weight: number;
    feedback_weight: number;
    dependency_weight: number;
    visibility_policy_id: string | null;
    creator_id: string;
    project_id: string | null;
    related_event_id: string | null;
    location: string | null;
    created_at: string;
    updated_at: string;
}

export interface Project {
    id: string;
    title: string;
    description: string | null;
    owner_group_id: string;
    progress_percent: number;
    status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
    visibility_policy_id: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface RatingSummary {
    schedule_id: string;
    total_ratings: number;
    avg_score: number;
    avg_usefulness: number | null;
    avg_importance_feedback: number | null;
}

export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
}

// ── Phase 2 Types ────────────────────────────────────────────

export interface ActivityNode {
    id: string;
    project_id: string;
    parent_id: string | null;
    related_schedule_id: string | null;
    node_type: "MILESTONE" | "TASK" | "SUB_TASK";
    title: string;
    status: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";
    progress: number;
    order_index: number;
    cost_hours: number;
    success_probability: number;
    reward_points: number;
    assigned_user_id: string | null;
    available_at: string | null;
    due_at: string | null;
    completed_at: string | null;
    version: number;
    created_at: string;
}

export interface ActivityEdge {
    id: string;
    from_node_id: string;
    to_node_id: string;
    edge_type: "DEPENDS_ON" | "RELATED_TO";
}

export interface Notification {
    id: string;
    user_id: string;
    type: string;
    title: string;
    body: string | null;
    related_schedule_id: string | null;
    related_project_id: string | null;
    is_read: boolean;
    created_at: string;
}

export interface Competition {
    id: string;
    event_id: string;
    max_participants: number | null;
    scoring_rule: Record<string, unknown> | null;
    opens_at: string | null;
    closes_at: string | null;
    freeze_at: string | null;
    scoreboard_public: boolean;
    created_at: string;
}

export interface CompetitionListItem extends Competition {
    title: string;
    event_status: string;
    participant_count: number;
    problem_count: number;
}

export interface Participant {
    id: string;
    competition_id: string;
    user_id: string;
    registered_at: string;
    status: "REGISTERED" | "CONFIRMED" | "WITHDRAWN";
}

export interface Submission {
    id: string;
    competition_id: string;
    participant_id: string;
    competition_problem_id: string | null;
    content: Record<string, unknown> | null;
    language: string | null;
    source_code: string | null;
    verdict:
    | "PENDING"
    | "QUEUED"
    | "RUNNING"
    | "ACCEPTED"
    | "PARTIAL"
    | "WRONG_ANSWER"
    | "TIME_LIMIT"
    | "MEMORY_LIMIT"
    | "RUNTIME_ERROR"
    | "COMPILE_ERROR"
    | "JUDGE_ERROR"
    | "MANUAL_REVIEW";
    score: number | null;
    penalty: number;
    execution_time_ms: number | null;
    memory_kb: number | null;
    judge_message: string | null;
    result_detail: Record<string, unknown> | null;
    submitted_at: string;
    graded_at: string | null;
    judged_at: string | null;
}

export interface Scoreboard {
    id: string;
    competition_id: string;
    snapshot_data: Record<string, unknown>;
    is_final: boolean;
    created_at: string;
}

export interface Problem {
    id: string;
    slug: string;
    title: string;
    statement_md: string;
    input_format_md: string;
    output_format_md: string;
    constraints_md: string;
    notes_md: string;
    time_limit_ms: number;
    memory_limit_mb: number;
    checker_type: "EXACT" | "TOKENS" | "FLOAT" | "SPECIAL" | "INTERACTIVE" | "MANUAL";
    scoring_mode: "BINARY" | "SUBTASK" | "OUTPUT_ONLY" | "MANUAL";
    status: "DRAFT" | "REVIEW" | "READY" | "PUBLISHED" | "ARCHIVED";
    difficulty: number | null;
    version: number;
    created_by: string;
    visibility_policy_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface ProblemTestCase {
    id: string;
    group_id: string;
    name: string;
    input_data: string;
    expected_output: string;
    is_sample: boolean;
    points: number | null;
    order_index: number;
    metadata_json: Record<string, unknown> | null;
}

export interface ProblemTestGroup {
    id: string;
    problem_id: string;
    name: string;
    points: number;
    order_index: number;
    dependency_group_ids: string[];
    scoring_policy: Record<string, unknown> | null;
    test_cases: ProblemTestCase[];
}

export interface ProblemSolution {
    id: string;
    problem_id: string;
    title: string;
    language: string;
    source_code: string;
    expected_complexity: string | null;
    is_reference: boolean;
    author_id: string;
    created_at: string;
}

export interface ProblemRevision {
    id: string;
    problem_id: string;
    version: number;
    snapshot_data: Record<string, unknown>;
    note: string | null;
    created_by: string;
    created_at: string;
}

export interface ProblemPackage extends Problem {
    test_groups: ProblemTestGroup[];
    solutions: ProblemSolution[];
    revisions: ProblemRevision[];
}

export interface CompetitionProblem {
    id: string;
    competition_id: string;
    problem_id: string;
    label: string;
    title_override: string | null;
    points: number;
    order_index: number;
    opens_at: string | null;
    closes_at: string | null;
    workflow_node_id: string | null;
    scoring_config: Record<string, unknown> | null;
    problem: Problem;
}

export interface LiveScoreboardRow {
    rank: number;
    participant_id: string;
    user_id: string;
    name: string;
    team_name: string | null;
    score: number;
    solved: number;
    penalty: number;
    last_improvement_at: string | null;
    problems: Record<
        string,
        {
            solved: boolean;
            attempts: number;
            score: number;
            max_score?: number;
            penalty?: number;
            verdict?: string | null;
        }
    >;
    frozen_submissions: number;
}

export interface LiveScoreboard {
    competition_id: string;
    mode: "IOI" | "ICPC" | string;
    generated_at: string;
    frozen: boolean;
    freeze_at: string | null;
    problems: { id: string; label: string; title: string; points: number }[];
    rankings: LiveScoreboardRow[];
}

export interface WorkflowProjection {
    project_id: string;
    generated_at: string;
    summary: {
        total: number;
        ready: number;
        blocked: number;
        overdue: number;
        progress: number;
    };
    nodes: Array<{
        id: string;
        title: string;
        type: string;
        status: string;
        progress: number;
        assigned_user_id: string | null;
        available_at: string | null;
        due_at: string | null;
        completed_at: string | null;
        ready: boolean;
        overdue: boolean;
        blocked_by: string[];
        unlocks: string[];
        version: number;
    }>;
    edges: Array<{ id: string; from: string; to: string; type: string }>;
}

// ── Phase 3 Types ────────────────────────────────────────────

export interface Challenge {
    id: string;
    challenge_type: "MATH" | "TEXT" | "LOGIC";
    challenge_data: {
        question: string;
        hint?: string;
    };
    max_attempts: number;
    attempts: number;
    status: "PENDING" | "VERIFIED" | "FAILED" | "EXPIRED";
    expires_at: string;
    created_at: string;
}

export interface VisibilityPolicy {
    id: string;
    scope_type: "PUBLIC" | "AUTHENTICATED" | "GROUP_ONLY" | "ROLE_ONLY" | "GROUP_AND_ROLE" | "PROCEDURAL_KEY";
    allow_public: boolean;
    allow_group_ids: string[];
    allow_role_names: string[];
    deny_group_ids: string[];
    rule_expression_json: Record<string, unknown> | null;
    created_at: string;
}

export interface HistoryEntry {
    id: string;
    changed_by: string;
    change_type: "CREATE" | "UPDATE" | "DELETE";
    previous_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
    changed_at: string;
}
