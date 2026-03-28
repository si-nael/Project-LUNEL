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
    status: "PENDING" | "IN_PROGRESS" | "DONE" | "BLOCKED";
    progress: number;
    order_index: number;
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
    created_at: string;
}

export interface Participant {
    id: string;
    competition_id: string;
    user_id: string;
    registered_at: string;
    status: "REGISTERED" | "CHECKED_IN" | "DISQUALIFIED" | "WITHDRAWN";
}

export interface Submission {
    id: string;
    competition_id: string;
    participant_id: string;
    content: Record<string, unknown> | null;
    score: number | null;
    submitted_at: string;
    graded_at: string | null;
}

export interface Scoreboard {
    id: string;
    competition_id: string;
    snapshot_data: Record<string, unknown>;
    is_final: boolean;
    created_at: string;
}
